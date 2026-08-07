import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';

export const metaRouter = Router();

metaRouter.use(authenticate);

// GET /meta/roles — catálogo de roles con sus permisos (para gestión RBAC).
metaRouter.get(
  '/roles',
  requirePermission(PERMISSIONS.PERMISSIONS_ASSIGN, PERMISSIONS.USERS_READ),
  async (_req, res) => {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json({
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map((rp) => rp.permission.key),
      })),
    });
  }
);

// GET /meta/suppliers — proveedores (para el Motor de Compra y órdenes).
metaRouter.get('/suppliers', async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  return res.json({ suppliers });
});
