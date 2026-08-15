import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { authRouter } from './modules/auth.routes';
import { inventoryRouter } from './modules/inventory.routes';
import { movementsRouter } from './modules/movements.routes';
import { purchasingRouter } from './modules/purchasing.routes';
import { alertsRouter } from './modules/alerts.routes';
import { auditRouter } from './modules/audit.routes';
import { usersRouter } from './modules/users.routes';
import { metaRouter } from './modules/meta.routes';
import { returnsRouter } from './modules/returns.routes';
import { suppliersRouter } from './modules/suppliers.routes';
import { patientsRouter } from './modules/clinicalHistory.routes';
import { integrationsRouter } from './modules/integrations.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'medline-api' }));

  // Documentación OpenAPI (Swagger UI). El archivo fuente vive en la raíz del
  // paquete backend/; se resuelve vía cwd porque los scripts npm (dev/start)
  // siempre corren con cwd=backend/, en dev y en producción por igual.
  const openApiSpec = yaml.load(
    fs.readFileSync(path.resolve(process.cwd(), 'openapi.yaml'), 'utf8')
  ) as Record<string, unknown>;
  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/auth', authRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/movements', movementsRouter);
  app.use('/api/purchasing', purchasingRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/meta', metaRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/patients', patientsRouter);
  app.use('/api/integrations', integrationsRouter);

  // Manejador de errores genérico.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  );

  return app;
}
