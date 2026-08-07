// -----------------------------------------------------------------------------
// 12. Servicio de auditoría inmutable (append-only).
// Sólo INSERT. No se exponen operaciones de update/delete a ninguna capa.
// -----------------------------------------------------------------------------
import { prisma } from '../db/prisma';

export interface AuditEntry {
  userId?: string | null;
  actionType: string;
  module: string;
  entity?: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
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
    },
  });
}
