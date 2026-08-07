import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { MOVEMENT_TYPES } from '../domain/enums';
import { recordAudit } from '../services/audit';

export const movementsRouter = Router();

movementsRouter.use(authenticate);

// GET /movements — libro de movimientos (con filtro opcional por ítem).
movementsRouter.get(
  '/',
  requirePermission(PERMISSIONS.MOVEMENTS_READ),
  async (req, res) => {
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
    const movements = await prisma.movement.findMany({
      where: itemId ? { itemId } : undefined,
      include: {
        item: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    return res.json({ movements });
  }
);

const movementSchema = z.object({
  itemId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  quantityDelta: z.number().int().refine((v) => v !== 0, 'La cantidad no puede ser 0'),
  movementType: z.enum(MOVEMENT_TYPES),
  sourceLocation: z.string().optional(),
  destinationLocation: z.string().optional(),
  note: z.string().optional(),
});

// POST /movements — registra un evento transaccional y ajusta el stock del lote.
movementsRouter.post(
  '/',
  requirePermission(PERMISSIONS.MOVEMENTS_CREATE),
  async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    try {
      const movement = await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: data.itemId } });
        if (!item) throw new Error('ITEM_NOT_FOUND');

        // Si el movimiento afecta un lote concreto, ajustamos su cantidad.
        if (data.batchId) {
          const batch = await tx.batch.findUnique({ where: { id: data.batchId } });
          if (!batch || batch.itemId !== data.itemId) throw new Error('BATCH_INVALID');
          const newQty = batch.availableQty + data.quantityDelta;
          if (newQty < 0) throw new Error('INSUFFICIENT_STOCK');
          await tx.batch.update({
            where: { id: batch.id },
            data: { availableQty: newQty },
          });
        }

        return tx.movement.create({
          data: {
            userId: req.auth!.userId,
            itemId: data.itemId,
            batchId: data.batchId,
            quantityDelta: data.quantityDelta,
            movementType: data.movementType,
            sourceLocation: data.sourceLocation,
            destinationLocation: data.destinationLocation,
            note: data.note,
          },
        });
      });

      await recordAudit({
        userId: req.auth!.userId,
        actionType: 'CREATE',
        module: 'movements',
        entity: 'Movement',
        entityId: movement.id,
        newValue: movement,
      });

      return res.status(201).json({ movement });
    } catch (err) {
      const code = (err as Error).message;
      const map: Record<string, [number, string]> = {
        ITEM_NOT_FOUND: [404, 'Ítem no encontrado'],
        BATCH_INVALID: [400, 'Lote inválido para este ítem'],
        INSUFFICIENT_STOCK: [409, 'Stock insuficiente en el lote'],
      };
      const [status, message] = map[code] ?? [500, 'Error al registrar el movimiento'];
      return res.status(status).json({ error: message });
    }
  }
);
