import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { BUSINESS_CONFIG } from '../config/constants';
import { computeUsefulStock } from '../domain/inventory';
import { buildRecommendation } from '../domain/purchasing';
import { getDailyConsumption } from '../services/analytics';
import { recordAudit } from '../services/audit';
import type { VenClass } from '../domain/enums';

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
        lines: { include: { item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ orders });
  }
);

const createOrderSchema = z.object({
  itemId: z.string().min(1),
  recommendedQty: z.number().int().min(1),
  rationale: z.string().optional(),
  supplierId: z.string().nullable().optional(),
});

// POST /purchasing/orders — crea una recomendación de compra aplicando la
// lógica antiduplicidad (sección 9.3): si existe una orden ABIERTA para el ítem
// con el mismo proveedor, actualiza la cantidad; si no, crea una nueva orden.
purchasingRouter.post(
  '/orders',
  requirePermission(PERMISSIONS.PURCHASING_MANAGE),
  async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const { itemId, recommendedQty, rationale, supplierId } = parsed.data;

    // Buscar una orden abierta que ya contenga (o pueda contener) este ítem.
    const openOrder = await prisma.purchaseOrder.findFirst({
      where: {
        status: 'OPEN',
        supplierId: supplierId ?? undefined,
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    if (openOrder) {
      const existingLine = openOrder.lines.find((l) => l.itemId === itemId);
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
          userId: req.auth!.userId,
          actionType: 'UPDATE',
          module: 'purchasing',
          entity: 'PurchaseOrderLine',
          entityId: updated.id,
          previousValue: { orderedQty: existingLine.orderedQty },
          newValue: { orderedQty: updated.orderedQty },
        });
        return res.json({ consolidated: true, orderId: openOrder.id, line: updated });
      }

      // Agregar una nueva línea a la orden abierta.
      const line = await prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: openOrder.id,
          itemId,
          recommendedQty,
          orderedQty: recommendedQty,
          rationale,
        },
      });
      return res.json({ consolidated: true, orderId: openOrder.id, line });
    }

    // No hay orden abierta → crear una nueva.
    const code = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const order = await prisma.purchaseOrder.create({
      data: {
        code,
        status: 'OPEN',
        supplierId: supplierId ?? null,
        createdById: req.auth!.userId,
        lines: {
          create: [{ itemId, recommendedQty, orderedQty: recommendedQty, rationale }],
        },
      },
      include: { lines: true },
    });
    await recordAudit({
      userId: req.auth!.userId,
      actionType: 'CREATE',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: order.id,
      newValue: { code: order.code, itemId, recommendedQty },
    });
    return res.status(201).json({ consolidated: false, order });
  }
);

// POST /purchasing/orders/:id/approve — autoridad de aprobación (Jefe de Farmacia).
purchasingRouter.post(
  '/orders/:id/approve',
  requirePermission(PERMISSIONS.PURCHASING_APPROVE),
  async (req, res) => {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.status !== 'OPEN' && order.status !== 'SUBMITTED') {
      return res.status(409).json({ error: `No se puede aprobar una orden en estado ${order.status}` });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'APPROVED', approvedById: req.auth!.userId, approvedAt: new Date() },
    });
    await recordAudit({
      userId: req.auth!.userId,
      actionType: 'APPROVE',
      module: 'purchasing',
      entity: 'PurchaseOrder',
      entityId: order.id,
      previousValue: { status: order.status },
      newValue: { status: 'APPROVED' },
    });
    return res.json({ order: updated });
  }
);
