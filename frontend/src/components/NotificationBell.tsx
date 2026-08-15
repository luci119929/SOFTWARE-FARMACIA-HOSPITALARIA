import { useState } from 'react';
import { useNotifications, type AppNotification } from '../hooks/useNotifications';
import { IconBell } from './icons';
import { Badge } from './ui';

function describe(n: AppNotification): string {
  const p = n.payload;
  switch (n.type) {
    case 'movements.created':
      return `Movimiento registrado: ${p.itemName} (${p.movementType}, ${p.quantityDelta as number > 0 ? '+' : ''}${p.quantityDelta})`;
    case 'purchasing.order_submitted':
      return `Orden ${p.code} enviada a aprobación`;
    case 'purchasing.order_approved':
      return `Orden ${p.code} aprobada`;
    case 'purchasing.order_rejected':
      return `Orden ${p.code} rechazada`;
    case 'purchasing.order_received':
      return `Orden ${p.code} recibida`;
    case 'returns.processed':
      return `Devolución ${p.code} procesada (${p.disposition})`;
    case 'returns.rejected':
      return `Devolución ${p.code} rechazada`;
    case 'clinical_history.entry_created':
      return `Nueva entrada en la historia clínica de ${p.patientName}: ${p.entryTitle}`;
    case 'clinical_history.entry_updated':
      return `Entrada de historia clínica actualizada (v${p.version}): ${p.entryTitle}`;
    default:
      return n.type;
  }
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const { notifications, connected, unread, markRead } = useNotifications(enabled);
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  function toggle() {
    setOpen((v) => !v);
    if (!open) markRead();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={toggle} aria-label="Notificaciones" title="Notificaciones">
        <IconBell size={18} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: '999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              display: 'grid',
              placeItems: 'center',
              padding: '0 3px',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            zIndex: 50,
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="row between card-pad" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <strong style={{ fontSize: '0.9rem' }}>Notificaciones</strong>
            <Badge tone={connected ? 'ok' : 'muted'}>{connected ? 'En vivo' : 'Reconectando…'}</Badge>
          </div>
          {notifications.length === 0 && (
            <div className="muted card-pad" style={{ fontSize: '0.85rem' }}>Sin novedades por ahora.</div>
          )}
          {notifications.map((n) => (
            <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.84rem' }}>{describe(n)}</div>
              <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                {new Date(n.timestamp).toLocaleTimeString('es')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
