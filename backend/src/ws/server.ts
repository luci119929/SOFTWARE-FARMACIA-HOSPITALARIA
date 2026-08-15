// -----------------------------------------------------------------------------
// Notificaciones en tiempo real (WebSocket).
// Reutiliza el JWT existente (mismo secreto/formato que la API REST) en vez de
// un esquema de auth paralelo. Cada evento se filtra por el permiso del
// recurso que representa antes de enviarse: un socket sólo recibe lo que su
// usuario también podría leer por REST (defensa en profundidad, igual que en
// el resto del backend).
// -----------------------------------------------------------------------------
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifyToken, type TokenPayload } from '../auth/jwt';

interface Client {
  socket: WebSocket;
  auth: TokenPayload;
}

const clients = new Set<Client>();

export interface NotificationEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Envía un evento a todos los sockets conectados cuyo usuario tenga el permiso indicado. */
export function broadcast(type: string, requiredPermission: string, payload: Record<string, unknown>) {
  const event: NotificationEvent = { type, payload, timestamp: new Date().toISOString() };
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.auth.permissions.includes(requiredPermission) && client.socket.readyState === client.socket.OPEN) {
      client.socket.send(message);
    }
  }
}

/** Cantidad de sockets conectados en este momento (para el endpoint de status). */
export function connectedClientCount(): number {
  return clients.size;
}

/**
 * Adjunta el servidor WebSocket al mismo servidor HTTP que Express, bajo
 * /ws. El token viaja como query param (?token=...) porque el WebSocket
 * handshake no admite un header Authorization custom desde el navegador.
 */
export function attachWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket, request) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    let auth: TokenPayload;
    try {
      if (!token) throw new Error('missing token');
      auth = verifyToken(token);
    } catch {
      socket.close(4001, 'No autenticado');
      return;
    }

    const client: Client = { socket, auth };
    clients.add(client);

    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });

  return wss;
}
