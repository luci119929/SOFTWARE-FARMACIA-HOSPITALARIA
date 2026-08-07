import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { hashPassword } from '../auth/passwords';
import { recordAudit, auditContext } from '../services/audit';

export const usersRouter = Router();

usersRouter.use(authenticate);

// GET /users — listado (CRUD de usuarios; sólo Administrador).
usersRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { role: { select: { key: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });
    return res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
      })),
    });
  }
);

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  roleId: z.string().min(1),
});

// POST /users — crear usuario.
usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const { email, fullName, password, roleId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'El correo ya está registrado' });

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.status(400).json({ error: 'Rol inválido' });

    const user = await prisma.user.create({
      data: { email, fullName, roleId, passwordHash: await hashPassword(password) },
    });
    await recordAudit({
      ...auditContext(req),
      actionType: 'CREATE',
      module: 'users',
      entity: 'User',
      entityId: user.id,
      newValue: { email, fullName, roleId },
    });
    return res.status(201).json({ user: { id: user.id, email, fullName, roleId } });
  }
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /users/:id — actualizar usuario.
usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data });
    await recordAudit({
      ...auditContext(req),
      actionType: 'UPDATE',
      module: 'users',
      entity: 'User',
      entityId: user.id,
      previousValue: { fullName: before.fullName, roleId: before.roleId, isActive: before.isActive },
      newValue: parsed.data,
    });
    return res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, roleId: user.roleId, isActive: user.isActive } });
  }
);

// DELETE /users/:id — desactivar (baja lógica; preserva trazabilidad histórica).
usersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  async (req, res) => {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Usuario no encontrado' });

    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({
      ...auditContext(req),
      actionType: 'DELETE',
      module: 'users',
      entity: 'User',
      entityId: req.params.id,
      previousValue: { isActive: before.isActive },
      newValue: { isActive: false },
    });
    return res.json({ ok: true });
  }
);
