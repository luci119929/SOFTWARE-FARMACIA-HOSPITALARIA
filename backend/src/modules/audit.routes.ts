import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';

export const auditRouter = Router();

auditRouter.use(authenticate);

// GET /audit — registro de auditoría (solo lectura, inmutable), con búsqueda
// de texto libre opcional sobre módulo, entidad, acción, usuario y el detalle
// del cambio (valores anterior/nuevo serializados).
// No existen endpoints PUT/PATCH/DELETE: la tabla es append-only por diseño.
auditRouter.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_READ),
  async (req, res) => {
    const take = Math.min(Number(req.query.limit ?? 200), 500);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;

    const entries = await prisma.auditLog.findMany({
      where: q
        ? {
            OR: [
              { module: { contains: q } },
              { entity: { contains: q } },
              { entityId: { contains: q } },
              { actionType: { contains: q } },
              { previousValue: { contains: q } },
              { newValue: { contains: q } },
              { user: { fullName: { contains: q } } },
              { user: { email: { contains: q } } },
            ],
          }
        : undefined,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take,
    });
    return res.json({ entries });
  }
);
