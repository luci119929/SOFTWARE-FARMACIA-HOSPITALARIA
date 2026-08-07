import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { RETURN_DISPOSITIONS, RETURN_REASONS } from '../domain/enums';
import { recordAudit, auditContext } from '../services/audit';

export const returnsRouter = Router();

returnsRouter.use(authenticate);

// GET /returns — lista de devoluciones (filtro opcional por estado/ítem).
returnsRouter.get(
  '/',
  requirePermission(PERMISSIONS.RETURNS_READ),
  async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
    const returns = await prisma.stockReturn.findMany({
      where: { status, itemId },
      include: {
        item: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
        requestedBy: { select: { id: true, fullName: true } },
        processedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json({ returns });
  }
);

// GET /returns/:id — detalle de una devolución.
returnsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.RETURNS_READ),
  async (req, res) => {
    const stockReturn = await prisma.stockReturn.findUnique({
      where: { id: req.params.id },
      include: {
        item: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
        requestedBy: { select: { id: true, fullName: true } },
        processedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!stockReturn) return res.status(404).json({ error: 'Devolución no encontrada' });
    return res.json({ return: stockReturn });
  }
);

const createReturnSchema = z.object({
  itemId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  quantity: z.number().int().min(1),
  reason: z.enum(RETURN_REASONS),
  sourceLocation: z.string().optional(),
  note: z.string().optional(),
});

// POST /returns — registra una devolución en estado PENDING.
returnsRouter.post(
  '/',
  requirePermission(PERMISSIONS.RETURNS_CREATE),
  async (req, res) => {
    const parsed = createReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const item = await prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

    if (data.batchId) {
      const batch = await prisma.batch.findUnique({ where: { id: data.batchId } });
      if (!batch || batch.itemId !== data.itemId) {
        return res.status(400).json({ error: 'Lote inválido para este ítem' });
      }
    }

    const code = `RET-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const stockReturn = await prisma.stockReturn.create({
      data: {
        code,
        itemId: data.itemId,
        batchId: data.batchId,
        quantity: data.quantity,
        reason: data.reason,
        sourceLocation: data.sourceLocation,
        note: data.note,
        requestedById: req.auth!.userId,
      },
    });

    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'returns',
      entity: 'StockReturn',
      entityId: stockReturn.id,
      newValue: stockReturn,
    });

    return res.status(201).json({ return: stockReturn });
  }
);

const processReturnSchema = z.object({
  disposition: z.enum(RETURN_DISPOSITIONS),
  batchNumber: z.string().optional(),
  expirationDate: z.coerce.date().optional(),
  physicalLocation: z.string().optional(),
  note: z.string().optional(),
});

// POST /returns/:id/process — decide la disposición final y ajusta el stock.
returnsRouter.post(
  '/:id/process',
  requirePermission(PERMISSIONS.RETURNS_PROCESS),
  async (req, res) => {
    const parsed = processReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await prisma.stockReturn.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: 'La devolución ya fue procesada o rechazada' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        let resultingMovementId: string | null = null;

        if (data.disposition === 'RESTOCK') {
          if (!data.batchNumber || !data.expirationDate || !data.physicalLocation) {
            throw new Error('RESTOCK_REQUIRES_BATCH_DATA');
          }
          const batch = await tx.batch.upsert({
            where: {
              itemId_batchNumber: { itemId: existing.itemId, batchNumber: data.batchNumber },
            },
            create: {
              itemId: existing.itemId,
              batchNumber: data.batchNumber,
              expirationDate: data.expirationDate,
              availableQty: existing.quantity,
              physicalLocation: data.physicalLocation,
            },
            update: {
              availableQty: { increment: existing.quantity },
            },
          });

          const movement = await tx.movement.create({
            data: {
              userId: req.auth!.userId,
              itemId: existing.itemId,
              batchId: batch.id,
              quantityDelta: existing.quantity,
              movementType: 'RETURN',
              destinationLocation: data.physicalLocation,
              note: `Devolución ${existing.code} reingresada a stock`,
            },
          });
          resultingMovementId = movement.id;
        }

        return tx.stockReturn.update({
          where: { id: existing.id },
          data: {
            status: 'PROCESSED',
            disposition: data.disposition,
            processedById: req.auth!.userId,
            processedAt: new Date(),
            resultingMovementId,
            note: data.note ?? existing.note,
          },
        });
      });

      await recordAudit({
        ...auditContext(req),
        actionType: 'UPDATE',
        module: 'returns',
        entity: 'StockReturn',
        entityId: existing.id,
        previousValue: { status: existing.status },
        newValue: { status: result.status, disposition: result.disposition },
      });

      return res.json({ return: result });
    } catch (err) {
      const code = (err as Error).message;
      const map: Record<string, [number, string]> = {
        RESTOCK_REQUIRES_BATCH_DATA:
          [400, 'Para reingresar a stock se requiere batchNumber, expirationDate y physicalLocation'],
      };
      const [status, message] = map[code] ?? [500, 'Error al procesar la devolución'];
      return res.status(status).json({ error: message });
    }
  }
);

// POST /returns/:id/reject — rechaza una devolución pendiente.
returnsRouter.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.RETURNS_PROCESS),
  async (req, res) => {
    const existing = await prisma.stockReturn.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: 'La devolución ya fue procesada o rechazada' });
    }

    const updated = await prisma.stockReturn.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        processedById: req.auth!.userId,
        processedAt: new Date(),
      },
    });

    await recordAudit({
      ...auditContext(req),
      actionType: 'REJECT',
      module: 'returns',
      entity: 'StockReturn',
      entityId: existing.id,
      previousValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return res.json({ return: updated });
  }
);
