import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/middleware';
import { PERMISSIONS } from '../auth/rbac';
import { hisAdapter } from '../integrations/his/MockHisAdapter';
import { recordAudit, auditContext } from '../services/audit';

export const integrationsRouter = Router();

integrationsRouter.use(authenticate);

// GET /integrations/his/status — salud/conectividad del adaptador HIS activo.
integrationsRouter.get(
  '/his/status',
  requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE),
  async (_req, res) => {
    const status = await hisAdapter.checkStatus();
    return res.json({ adapter: hisAdapter.name, ...status });
  }
);

// POST /integrations/his/sync — dispara una sincronización manual entrante
// (pacientes + prescripciones). En un HIS real esto normalmente sería
// también un job periódico o un webhook entrante; se deja el disparo manual
// para poder demostrarlo y depurarlo sin esperar un scheduler.
integrationsRouter.post(
  '/his/sync',
  requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE),
  async (req, res) => {
    const patients = await hisAdapter.syncPatients();
    const prescriptions = await hisAdapter.syncPrescriptions();

    await recordAudit({
      ...auditContext(req),
      actionType: 'SYNC',
      module: 'integrations',
      entity: 'HisAdapter',
      newValue: { adapter: hisAdapter.name, patients, prescriptions },
    });

    return res.json({ adapter: hisAdapter.name, patients, prescriptions });
  }
);
