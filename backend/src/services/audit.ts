// -----------------------------------------------------------------------------
// 12. Servicio de auditoría inmutable (append-only).
// Sólo INSERT. No se exponen operaciones de update/delete a ninguna capa.
// -----------------------------------------------------------------------------
import type { Request } from 'express';
import { prisma } from '../db/prisma';

export interface AuditEntry {
  userId?: string | null;
  actionType: string;
  module: string;
  entity?: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  roleKey?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      actionType: entry.actionType,
      module: entry.module,
      entity: entry.entity,
      entityId: entry.entityId,
      previousValue:
        entry.previousValue !== undefined
          ? JSON.stringify(entry.previousValue)
          : null,
      newValue:
        entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      roleKey: entry.roleKey ?? null,
    },
  });
}

/**
 * Extrae el contexto de sesión/red del request autenticado, listo para
 * spreadear dentro de un AuditEntry: `recordAudit({ ...auditContext(req), ... })`.
 */
export function auditContext(
  req: Request
): Pick<AuditEntry, 'userId' | 'ipAddress' | 'userAgent' | 'roleKey'> {
  return {
    userId: req.auth?.userId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    roleKey: req.auth?.roleKey ?? null,
  };
}
