import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { Badge, ErrorState, Loading } from '../components/ui';

interface HisStatus {
  adapter: string;
  connected: boolean;
  latencyMs: number;
  details: string;
}

interface HisSyncResult {
  adapter: string;
  patients: { synced: number; details: string };
  prescriptions: { synced: number; details: string };
}

export function IntegrationsPage() {
  const status = useApi<HisStatus>('/integrations/his/status');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<HisSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<HisSyncResult>('/integrations/his/sync');
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Integraciones</h1>
        <p className="page-sub">
          Costura hacia el Sistema de Información Hospitalaria (HIS). Hoy corre contra un
          adaptador simulado — sin HIS real configurado — listo para reemplazar por uno real.
        </p>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>Estado del HIS</h2>
        {status.loading && <Loading />}
        {status.error && <ErrorState message={status.error} />}
        {status.data && (
          <>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <Badge tone={status.data.connected ? 'ok' : 'danger'}>
                {status.data.connected ? 'Conectado' : 'Desconectado'}
              </Badge>
              <span className="muted">{status.data.adapter}</span>
            </div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>{status.data.details}</div>
            <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Latencia simulada: {status.data.latencyMs} ms
            </div>
          </>
        )}

        <button className="btn btn-primary btn-sm mt-16" disabled={syncing} onClick={sync}>
          {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>

        {error && <div className="muted" style={{ marginTop: 10, color: 'var(--danger)' }}>{error}</div>}
        {result && (
          <div className="mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.88rem' }}>
              <strong>Pacientes:</strong> {result.patients.synced} sincronizados — {result.patients.details}
            </div>
            <div style={{ fontSize: '0.88rem', marginTop: 6 }}>
              <strong>Prescripciones:</strong> {result.prescriptions.synced} sincronizadas — {result.prescriptions.details}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
