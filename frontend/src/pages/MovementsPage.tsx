import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { InventoryItem, Movement } from '../api/types';

const TYPE_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolución',
  INTERNAL_TRANSFER: 'Traslado interno',
};

export function MovementsPage() {
  const { can } = useAuth();
  const movements = useApi<{ movements: Movement[] }>('/movements');
  const inventory = useApi<{ items: InventoryItem[] }>('/inventory');
  const canCreate = can(P.MOVEMENTS_CREATE);

  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('EXIT');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const magnitude = Math.abs(Number(qty));
      // Salidas y traslados restan; entradas y devoluciones suman.
      const sign = type === 'EXIT' || type === 'INTERNAL_TRANSFER' ? -1 : 1;
      await api.post('/movements', {
        itemId,
        quantityDelta: sign * magnitude,
        movementType: type,
        note: note || undefined,
      });
      setMsg('Movimiento registrado.');
      setItemId('');
      setQty('');
      setNote('');
      movements.reload();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al registrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Movimientos</h1>
        <p className="page-sub">Libro transaccional del inventario (event-driven).</p>
      </div>

      <div className="grid-2">
        {canCreate && (
          <div className="card card-pad">
            <h2 style={{ fontSize: '1.05rem' }}>Registrar movimiento</h2>
            <form onSubmit={submit}>
              <div className="field">
                <label>Medicamento</label>
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                  <option value="">Seleccionar…</option>
                  {inventory.data?.items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Cantidad</label>
                  <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Nota (opcional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar'}
              </button>
            </form>
          </div>
        )}

        <div style={{ gridColumn: canCreate ? 'auto' : '1 / -1' }}>
          <h2 style={{ fontSize: '1.05rem' }}>Historial reciente</h2>
          {movements.loading && <Loading />}
          {movements.error && <ErrorState message={movements.error} />}
          {movements.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Medicamento</th>
                    <th>Tipo</th>
                    <th>Δ</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.data.movements.slice(0, 40).map((m) => (
                    <tr key={m.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(m.timestamp).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      </td>
                      <td>{m.item.name}</td>
                      <td><Badge tone="muted">{TYPE_LABELS[m.movementType] ?? m.movementType}</Badge></td>
                      <td style={{ fontWeight: 700, color: m.quantityDelta < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                        {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                      </td>
                      <td className="muted">{m.user.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
