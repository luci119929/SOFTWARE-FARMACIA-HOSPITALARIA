import { useEffect, useRef, useState } from 'react';
import { getToken } from '../api/client';

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const MAX_NOTIFICATIONS = 30;
const RECONNECT_DELAY_MS = 3000;

// Conecta al canal de notificaciones en tiempo real (ver backend/src/ws/server.ts).
// Reconecta automáticamente mientras haya sesión activa; se desconecta solo
// si el usuario cierra sesión (token ausente) o el componente se desmonta.
export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function connect() {
      const token = getToken();
      if (!token || cancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setNotifications((prev) => [
            { id: `${parsed.timestamp}-${Math.random()}`, ...parsed },
            ...prev,
          ].slice(0, MAX_NOTIFICATIONS));
          setUnread((n) => n + 1);
        } catch {
          // Ignora mensajes que no puedan parsearse.
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [enabled]);

  function markRead() {
    setUnread(0);
  }

  return { notifications, connected, unread, markRead };
}
