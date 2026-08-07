import { useApi } from '../api/useApi';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { AuditEntry } from '../api/types';

function formatDelta(prev: string | null, next: string | null): string {
  if (!prev && !next) return '—';
  const p = prev ? tryParse(prev) : null;
  const n = next ? tryParse(next) : null;
  if (p && n) return `${p} → ${n}`;
  return n ?? p ?? '—';
}
function tryParse(s: string): string {
  try {
    const v = JSON.parse(s);
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch {
    return s;
  }
}

export function AuditPage() {
  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>('/audit');

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Registro de Auditoría</h1>
        <p className="page-sub">
          Bitácora inmutable (append-only). Ningún usuario —incluido el Administrador— puede modificar o eliminar registros.
        </p>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      {data && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Entidad</th>
                <th>Cambio (Δ)</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="muted mono" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(e.timestamp).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>{e.user?.fullName ?? <span className="muted">sistema</span>}</td>
                  <td><Badge tone={e.actionType === 'DELETE' ? 'danger' : e.actionType === 'LOGIN' ? 'info' : 'muted'}>{e.actionType}</Badge></td>
                  <td className="muted">{e.module}</td>
                  <td className="muted">{e.entity ?? '—'}</td>
                  <td className="mono" style={{ fontSize: '0.8rem', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDelta(e.previousValue, e.newValue)}
                  </td>
                </tr>
              ))}
              {data.entries.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
