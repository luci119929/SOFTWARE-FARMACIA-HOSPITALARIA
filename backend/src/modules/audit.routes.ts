import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';

export const auditRouter = Router();

auditRouter.use(authenticate);

// GET /audit — registro de auditoría (solo lectura, inmutable).
// No existen endpoints PUT/PATCH/DELETE: la tabla es append-only por diseño.
auditRouter.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_READ),
  async (req, res) => {
    const take = Math.min(Number(req.query.limit ?? 200), 500);
    const entries = await prisma.auditLog.findMany({
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take,
    });
    return res.json({ entries });
  }
);
