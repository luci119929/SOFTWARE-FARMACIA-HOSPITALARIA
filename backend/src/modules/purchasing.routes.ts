import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { BUSINESS_CONFIG } from '../config/constants';
import { computeUsefulStock } from '../domain/inventory';
import { buildRecommendation, canTransitionPoStatus } from '../domain/purchasing';
import { getDailyConsumption } from '../services/analytics';
import { recordAudit, auditContext, getPurchaseOrderHistory } from '../services/audit';
import { broadcast } from '../ws/server';
import type { PoStatus, VenClass } from '../domain/enums';

export const purchasingRouter = Router();

purchasingRouter.use(authenticate);

// GET /purchasing/recommendations — corre el Motor de Compra sobre todo el catálogo.
purchasingRouter.get(
  '/recommendations',
  requirePermission(PERMISSIONS.PURCHASING_READ),
  async (_req, res) => {
    const items = await prisma.item.findMany({
      include: { batches: true, supplier: true },
    });

    const recommendations = [];
    for (const item of items) {
      const stock = computeUsefulStock(item.batches, BUSINESS_CONFIG.expiryRiskWindowDays);
      const history = await getDailyConsumption(
        item.id,
        BUSINESS_CONFIG.consumptionHistoryDays
      );
      const leadTime = item.leadTimeDaysOverride ?? item.supplier?.leadTimeDays ?? 7;
      const refrigerated = item.storageCondition === 'REFRIGERATED';
      const availableCapacity =
        item.maxStorageCapacity > 0
          ? Math.max(0, item.maxStorageCapacity - stock.usefulStock)
          : Number.MAX_SAFE_INTEGER;

      const rec = buildRecommendation({
        itemId: item.id,
        itemName: item.name,
        ven: item.venClassification as VenClass,
        usefulStock: stock.usefulStock,
        dailyConsumptionHistory: history,
        leadTimeDays: leadTime,
        moq: item.moq,
        maxStorageCapacity: item.maxStorageCapacity,
        availableStorageCapacity: availableCapacity,
        refrigerated,
      });
      recommendations.push({ ...rec, supplierId: item.supplier?.id ?? null });
    }

    // Sólo devolvemos las que dispararon recomendación, ordenadas por urgencia.
    const triggered = recommendations
      .filter((r) => r.triggered)
      .sort((a, b) => a.usefulStock - a.reorderPoint - (b.usefulStock - b.reorderPoint));

    return res.json({ recommendations: triggered, evaluated: recommendations.length });
  }
);

// GET /purchasing/orders — órdenes de compra (abiertas / históricas).
purchasingRouter.get(
  '/orders',
  requirePermission(PERMISSIONS.PURCHASING_READ),
  async (_req, res) => {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        rejectedBy: { select: { id: true, fullName: true } },
        lines: { include: { item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ orders });
  }
);

// GET /purchasing/orders/:id — detalle de una orden.
purchasingRouter.get(
  '/orders/:id',
  requirePermission(PERMISSIONS.PURCHASING_READ),
  async (req, res) => {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        rejectedBy: { select: { id: true, fullName: true } },
        lines: { include: { item: { select: { id: true, name: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    return res.json({ order });
  }
);

// GET /purchasing/orders/:id/history — historial de cambios (vía AuditLog).
purchasingRouter.get(
  '/orders/:id/history',
  requirePermission(PERMISSIONS.PURCHASING_READ),
  async (req, res) => {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    const history = await getPurchaseOrderHistory(req.params.id);
    return res.json({ history });
  }
);

const createOrderSchema = z.object({
  itemId: z.string().min(1),
  recommendedQty: z.number().int().min(1),
  rationale: z.string().optional(),
  supplierId: z.string().nullable().optional(),
});

// POST /purchasing/orders — crea una recomendación de compra aplicando la
// lógica antiduplicidad (sección 9.3): si existe una orden en BORRADOR para el
// ítem con el mismo proveedor, actualiza la cantidad; si no, crea una nueva.
purchasingRouter.post(
  '/orders',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const { itemId, recommendedQty, rationale, supplierId } = parsed.data;

    // Buscar una orden en borrador que ya contenga (o pueda contener) este ítem.
    const draftOrder = await prisma.purchaseOrder.findFirst({
      where: {
        status: 'DRAFT',
        supplierId: supplierId ?? undefined,
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    if (draftOrder) {
      const existingLine = draftOrder.lines.find((l) => l.itemId === itemId);
      if (existingLine) {
        // Consolidar: actualizar la cantidad en la línea existente.
        const updated = await prisma.purchaseOrderLine.update({
          where: { id: existingLine.id },
          data: {
            recommendedQty,
            orderedQty: recommendedQty,
            rationale: rationale ?? existingLine.rationale,
          },
        });
        await recordAudit({
          ...auditContext(req),
          actionType: 'UPDATE',
          module: 'purchasing',
          entity: 'PurchaseOrderLine',
          entityId: updated.id,
          previousValue: { orderedQty: existingLine.orderedQty },
          newValue: { orderedQty: updated.orderedQty },
        });
        return res.json({ consolidated: true, orderId: draftOrder.id, line: updated });
      }

      // Agregar una nueva línea a la orden en borrador.
      const line = await prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: draftOrder.id,
          itemId,
          recommendedQty,
          orderedQty: recommendedQty,
          rationale,
        },
      });
      return res.json({ consolidated: true, orderId: draftOrder.id, line });
    }

    // No hay orden en borrador → crear una nueva.
    const code = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const order = await prisma.purchaseOrder.create({
      data: {
        code,
        status: 'DRAFT',
        supplierId: supplierId ?? null,
        createdById: req.auth!.userId,
        lines: {
          create: [{ itemId, recommendedQty, orderedQty: recommendedQty, rationale }],
        },
      },
      include: { lines: true },
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: order.id,
      newValue: { code: order.code, itemId, recommendedQty },
    });
    return res.status(201).json({ consolidated: false, order });
  }
);

async function checkTransition(
  orderId: string,
  target: PoStatus
): Promise<
  | { ok: true; order: { status: string } }
  | { ok: false; status: number; body: { error: string } }
> {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, status: 404, body: { error: 'Orden no encontrada' } };
  if (!canTransitionPoStatus(order.status as PoStatus, target)) {
    return {
      ok: false,
      status: 409,
      body: { error: `No se puede pasar la orden de ${order.status} a ${target}` },
    };
  }
  return { ok: true, order };
}

// POST /purchasing/orders/:id/submit — envía una orden en borrador a aprobación.
purchasingRouter.post(
  '/orders/:id/submit',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  async (req, res) => {
    const check = await checkTransition(req.params.id, 'SUBMITTED');
    if (!check.ok) return res.status(check.status).json(check.body);
    const order = check.order;

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED' },
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'SUBMIT',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: req.params.id,
      previousValue: { status: order.status },
      newValue: { status: 'SUBMITTED' },
    });
    broadcast('purchasing.order_submitted', PERMISSIONS.PURCHASING_READ, {
      orderId: updated.id,
      code: updated.code,
      status: updated.status,
    });
    return res.json({ order: updated });
  }
);

// POST /purchasing/orders/:id/approve — autoridad de aprobación (Jefe de Farmacia).
purchasingRouter.post(
  '/orders/:id/approve',
  requirePermission(PERMISSIONS.PURCHASING_APPROVE),
  async (req, res) => {
    const check = await checkTransition(req.params.id, 'APPROVED');
    if (!check.ok) return res.status(check.status).json(check.body);
    const order = check.order;

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedById: req.auth!.userId, approvedAt: new Date() },
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'APPROVE',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: req.params.id,
      previousValue: { status: order.status },
      newValue: { status: 'APPROVED' },
    });
    broadcast('purchasing.order_approved', PERMISSIONS.PURCHASING_READ, {
      orderId: updated.id,
      code: updated.code,
      status: updated.status,
    });
    return res.json({ order: updated });
  }
);

const rejectOrderSchema = z.object({ reason: z.string().min(1) });

// POST /purchasing/orders/:id/reject — rechaza una orden enviada a aprobación.
purchasingRouter.post(
  '/orders/:id/reject',
  requirePermission(PERMISSIONS.PURCHASING_APPROVE),
  async (req, res) => {
    const parsed = rejectOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const check = await checkTransition(req.params.id, 'REJECTED');
    if (!check.ok) return res.status(check.status).json(check.body);
    const order = check.order;

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectedById: req.auth!.userId,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'REJECT',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: req.params.id,
      previousValue: { status: order.status },
      newValue: { status: 'REJECTED', reason: parsed.data.reason },
    });
    broadcast('purchasing.order_rejected', PERMISSIONS.PURCHASING_READ, {
      orderId: updated.id,
      code: updated.code,
      status: updated.status,
      reason: parsed.data.reason,
    });
    return res.json({ order: updated });
  }
);

const receiveOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        receivedQty: z.number().int().min(1),
        batchNumber: z.string().min(1),
        expirationDate: z.coerce.date(),
        physicalLocation: z.string().min(1),
        unitCost: z.number().min(0).optional(),
      })
    )
    .min(1),
});

// POST /purchasing/orders/:id/receive — recepción física de mercadería.
// Conecta por fin el flujo de compras con el inventario real: por cada línea
// recibida se actualiza (o crea) el lote correspondiente y se registra el
// movimiento de stock, en una única transacción. Soporta recepción parcial.
purchasingRouter.post(
  '/orders/:id/receive',
  requirePermission(PERMISSIONS.INVENTORY_SUPPLY),
  async (req, res) => {
    const parsed = receiveOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status !== 'APPROVED') {
      return res.status(409).json({ error: `Sólo se puede recibir una orden APPROVED (actual: ${order.status})` });
    }

    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        for (const receipt of parsed.data.lines) {
          const line = order.lines.find((l) => l.id === receipt.lineId);
          if (!line) throw new Error('LINE_NOT_FOUND');
          if (line.receivedQty + receipt.receivedQty > line.orderedQty) {
            throw new Error('OVER_RECEIPT');
          }

          const batch = await tx.batch.upsert({
            where: {
              itemId_batchNumber: { itemId: line.itemId, batchNumber: receipt.batchNumber },
            },
            create: {
              itemId: line.itemId,
              batchNumber: receipt.batchNumber,
              expirationDate: receipt.expirationDate,
              availableQty: receipt.receivedQty,
              physicalLocation: receipt.physicalLocation,
            },
            update: {
              availableQty: { increment: receipt.receivedQty },
            },
          });

          await tx.movement.create({
            data: {
              userId: req.auth!.userId,
              itemId: line.itemId,
              batchId: batch.id,
              quantityDelta: receipt.receivedQty,
              movementType: 'ENTRY',
              destinationLocation: receipt.physicalLocation,
              note: `Recepción de orden ${order.code}`,
            },
          });

          await tx.purchaseOrderLine.update({
            where: { id: line.id },
            data: {
              receivedQty: { increment: receipt.receivedQty },
              unitCost: receipt.unitCost ?? line.unitCost,
            },
          });
        }

        const refreshedLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: order.id },
        });
        const fullyReceived = refreshedLines.every((l) => l.receivedQty >= l.orderedQty);

        return tx.purchaseOrder.update({
          where: { id: order.id },
          data: fullyReceived
            ? { status: 'RECEIVED', receivedAt: new Date() }
            : {},
          include: { lines: true },
        });
      });

      await recordAudit({
        ...auditContext(req),
        actionType: 'RECEIVE',
        module: 'purchasing',
        entity: 'PurchaseOrder',
        entityId: order.id,
        previousValue: { status: order.status },
        newValue: { status: updatedOrder.status, lines: parsed.data.lines },
      });
      broadcast('purchasing.order_received', PERMISSIONS.PURCHASING_READ, {
        orderId: updatedOrder.id,
        code: updatedOrder.code,
        status: updatedOrder.status,
      });

      return res.json({ order: updatedOrder });
    } catch (err) {
      const code = (err as Error).message;
      const map: Record<string, [number, string]> = {
        LINE_NOT_FOUND: [400, 'La línea indicada no pertenece a esta orden'],
        OVER_RECEIPT: [400, 'La cantidad recibida supera lo pendiente en la línea'],
      };
      const [status, message] = map[code] ?? [500, 'Error al registrar la recepción'];
      return res.status(status).json({ error: message });
    }
  }
);
