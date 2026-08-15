import { createApp } from './app';
import { env } from './config/env';
import { attachWebSocketServer } from './ws/server';

const app = createApp();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`MedLine API escuchando en http://localhost:${env.port}`);
});

attachWebSocketServer(server);
