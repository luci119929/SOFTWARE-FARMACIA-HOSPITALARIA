import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { verifyPassword } from '../auth/passwords';
import { signToken } from '../auth/jwt';
import { authenticate } from '../auth/middleware';
import { recordAudit } from '../services/audit';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Flujo de autenticación (sección 2): valida credenciales, obtiene el Role_ID,
// carga los permisos mapeados y devuelve el token + el set de permisos para que
// la UI renderice dinámicamente los módulos autorizados.
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const permissions = user.role.permissions.map((rp) => rp.permission.key);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await recordAudit({
    userId: user.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    roleKey: user.role.key,
    actionType: 'LOGIN',
    module: 'auth',
    entity: 'User',
    entityId: user.id,
  });

  const token = signToken({
    userId: user.id,
    email: user.email,
    roleKey: user.role.key,
    permissions,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: { key: user.role.key, name: user.role.name },
      permissions,
    },
  });
});

// Perfil del usuario autenticado (para rehidratar sesión en el frontend).
authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: { key: user.role.key, name: user.role.name },
    permissions: user.role.permissions.map((rp) => rp.permission.key),
  });
});
