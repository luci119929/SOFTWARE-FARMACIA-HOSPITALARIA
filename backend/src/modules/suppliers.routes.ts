import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { recordAudit, auditContext } from '../services/audit';

export const suppliersRouter = Router();

suppliersRouter.use(authenticate);

// GET /suppliers — lista de proveedores (filtro opcional por activos).
suppliersRouter.get(
  '/',
  requirePermission(PERMISSIONS.SUPPLIERS_READ),
  async (req, res) => {
    const isActiveParam = req.query.isActive;
    const isActive =
      isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;
    const suppliers = await prisma.supplier.findMany({
      where: { isActive },
      orderBy: { name: 'asc' },
    });
    return res.json({ suppliers });
  }
);

// GET /suppliers/:id — detalle con ítems asociados.
suppliersRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_READ),
  async (req, res) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: { items: { select: { id: true, name: true, abcClassification: true, venClassification: true } } },
    });
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    return res.json({ supplier });
  }
);

// GET /suppliers/:id/purchase-history — agregación de compras a este proveedor.
suppliersRouter.get(
  '/:id/purchase-history',
  requirePermission(PERMISSIONS.SUPPLIERS_READ),
  async (req, res) => {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const orders = await prisma.purchaseOrder.findMany({
      where: { supplierId: req.params.id },
      include: { lines: true },
    });

    const totalOrders = orders.length;
    const totalUnitsOrdered = orders.reduce(
      (sum, o) => sum + o.lines.reduce((s, l) => s + l.orderedQty, 0),
      0
    );
    const countByStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    const receivedOrders = orders.filter((o) => o.status === 'RECEIVED' && o.approvedAt && o.receivedAt);
    const leadTimesDays = receivedOrders.map(
      (o) => (o.receivedAt!.getTime() - o.approvedAt!.getTime()) / (1000 * 60 * 60 * 24)
    );
    const averageActualLeadTimeDays =
      leadTimesDays.length > 0
        ? Number((leadTimesDays.reduce((a, b) => a + b, 0) / leadTimesDays.length).toFixed(1))
        : null;

    return res.json({
      supplierId: supplier.id,
      totalOrders,
      totalUnitsOrdered,
      countByStatus,
      nominalLeadTimeDays: supplier.leadTimeDays,
      averageActualLeadTimeDays,
    });
  }
);

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  leadTimeDays: z.number().int().min(0).optional(),
});

// POST /suppliers — crea un proveedor.
suppliersRouter.post(
  '/',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  async (req, res) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const supplier = await prisma.supplier.create({ data: parsed.data });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'suppliers',
      entity: 'Supplier',
      entityId: supplier.id,
      newValue: supplier,
    });
    return res.status(201).json({ supplier });
  }
);

// PATCH /suppliers/:id — actualiza un proveedor.
suppliersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  async (req, res) => {
    const parsed = supplierSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const before = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'UPDATE',
      module: 'suppliers',
      entity: 'Supplier',
      entityId: supplier.id,
      previousValue: before,
      newValue: parsed.data,
    });
    return res.json({ supplier });
  }
);

// DELETE /suppliers/:id — baja lógica.
suppliersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  async (req, res) => {
    const before = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Proveedor no encontrado' });

    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({
      ...auditContext(req),
      actionType: 'DELETE',
      module: 'suppliers',
      entity: 'Supplier',
      entityId: req.params.id,
      previousValue: { isActive: before.isActive },
      newValue: { isActive: false },
    });
    return res.json({ ok: true });
  }
);
