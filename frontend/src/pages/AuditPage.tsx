import { useState } from 'react';
import { useApi } from '../api/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { exportTableToPdf } from '../utils/pdf';
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

function exportAuditPdf(entries: AuditEntry[], search: string) {
  exportTableToPdf({
    title: 'Reporte de Auditoría',
    subtitle: search ? `Filtro: "${search}" · ${entries.length} registros` : `${entries.length} registros`,
    columns: ['Fecha/Hora', 'Usuario', 'Acción', 'Módulo', 'Entidad', 'Cambio'],
    rows: entries.map((e) => [
      new Date(e.timestamp).toLocaleString('es'),
      e.user?.fullName ?? 'sistema',
      e.actionType,
      e.module,
      e.entity ?? '—',
      formatDelta(e.previousValue, e.newValue),
    ]),
    filename: `auditoria-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
}

export function AuditPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>(
    debouncedSearch ? `/audit?q=${encodeURIComponent(debouncedSearch)}` : '/audit'
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Registro de Auditoría</h1>
      </div>

      <div className="row wrap between" style={{ marginBottom: 16, gap: 12 }}>
        <input
          style={{ maxWidth: 320 }}
          placeholder="Buscar por módulo, entidad, usuario, acción, valor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {data && data.entries.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => exportAuditPdf(data.entries, search)}>
            Exportar PDF
          </button>
        )}
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
