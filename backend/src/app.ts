import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRouter } from './modules/auth.routes';
import { inventoryRouter } from './modules/inventory.routes';
import { movementsRouter } from './modules/movements.routes';
import { purchasingRouter } from './modules/purchasing.routes';
import { alertsRouter } from './modules/alerts.routes';
import { auditRouter } from './modules/audit.routes';
import { usersRouter } from './modules/users.routes';
import { metaRouter } from './modules/meta.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'medline-api' }));

  app.use('/api/auth', authRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/movements', movementsRouter);
  app.use('/api/purchasing', purchasingRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/meta', metaRouter);

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
