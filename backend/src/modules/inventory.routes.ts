import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { BUSINESS_CONFIG } from '../config/constants';
import { computeUsefulStock, orderByFefo } from '../domain/inventory';
import { computePriority } from '../domain/classification';
import { ABC_CLASSES, VEN_CLASSES, STORAGE_CONDITIONS } from '../domain/enums';
import { recordAudit, auditContext } from '../services/audit';
import type { AbcClass, VenClass } from '../domain/enums';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

// GET /inventory — lista de ítems con Stock Útil y puntuación de prioridad.
inventoryRouter.get(
  '/',
  requirePermission(PERMISSIONS.INVENTORY_READ),
  async (_req, res) => {
    const items = await prisma.item.findMany({
      include: { batches: true, supplier: true },
      orderBy: { name: 'asc' },
    });

    const enriched = items.map((item) => {
      const stock = computeUsefulStock(
        item.batches,
        BUSINESS_CONFIG.expiryRiskWindowDays
      );
      const priority = computePriority({
        abc: item.abcClassification as AbcClass,
        ven: item.venClassification as VenClass,
        daysToNearestExpiry: stock.daysToNearestExpiry,
      });
      return {
        id: item.id,
        name: item.name,
        activeIngredient: item.activeIngredient,
        manufacturer: item.manufacturer,
        presentation: item.presentation,
        concentration: item.concentration,
        therapeuticCategory: item.therapeuticCategory,
        abcClassification: item.abcClassification,
        venClassification: item.venClassification,
        storageCondition: item.storageCondition,
        minimumThreshold: item.minimumThreshold,
        supplier: item.supplier ? { id: item.supplier.id, name: item.supplier.name } : null,
        stock,
        priority,
        batchCount: item.batches.length,
      };
    });

    // Ordenar por prioridad descendente (matriz ABC+VEN+FEFO).
    enriched.sort((a, b) => b.priority.score - a.priority.score);
    return res.json({ items: enriched });
  }
);

// GET /inventory/:id — detalle con lotes ordenados por FEFO.
inventoryRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.INVENTORY_READ),
  async (req, res) => {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: { batches: true, supplier: true },
    });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

    const stock = computeUsefulStock(item.batches, BUSINESS_CONFIG.expiryRiskWindowDays);
    const priority = computePriority({
      abc: item.abcClassification as AbcClass,
      ven: item.venClassification as VenClass,
      daysToNearestExpiry: stock.daysToNearestExpiry,
    });

    return res.json({
      item: { ...item, stock, priority, batches: orderByFefo(item.batches) },
    });
  }
);

const itemSchema = z.object({
  name: z.string().min(1),
  activeIngredient: z.string().min(1),
  manufacturer: z.string().min(1),
  presentation: z.string().min(1),
  concentration: z.string().min(1),
  therapeuticCategory: z.string().min(1),
  abcClassification: z.enum(ABC_CLASSES),
  venClassification: z.enum(VEN_CLASSES),
  storageCondition: z.enum(STORAGE_CONDITIONS),
  minimumThreshold: z.number().int().min(0).default(0),
  maxStorageCapacity: z.number().int().min(0).default(0),
  moq: z.number().int().min(1).default(1),
  leadTimeDaysOverride: z.number().int().min(0).nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

// POST /inventory — crear ítem (gestión operativa de inventario).
inventoryRouter.post(
  '/',
  requirePermission(PERMISSIONS.INVENTORY_MANAGE),
  async (req, res) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const item = await prisma.item.create({ data: parsed.data });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'inventory',
      entity: 'Item',
      entityId: item.id,
      newValue: item,
    });
    return res.status(201).json({ item });
  }
);
