import { useApi } from '../api/useApi';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { AlertItem } from '../api/types';

const TYPE_LABELS: Record<string, string> = {
  CRITICAL_STOCK: 'Stock crítico',
  EXPIRY_RISK: 'Riesgo de vencimiento',
  COLD_CHAIN_BREACH: 'Cadena de frío',
  ANOMALOUS_CONSUMPTION: 'Consumo anómalo',
};

export function AlertsPage() {
  const { data, loading, error } = useApi<{ alerts: AlertItem[] }>('/alerts');
  const alerts = data?.alerts ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Alertas</h1>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      {!loading && alerts.length === 0 && (
        <div className="card card-pad muted">Sin alertas activas. El inventario está bajo control.</div>
      )}

      <div className="mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((a, i) => {
          const tone = a.severity === 'CRITICAL' ? 'danger' : a.severity === 'WARNING' ? 'warn' : 'info';
          return (
            <div key={i} className="card card-pad row" style={{ gap: 14, borderLeft: `4px solid var(--${tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'brand-500'})` }}>
              <Badge tone={tone}>{TYPE_LABELS[a.type] ?? a.type}</Badge>
              <span style={{ flex: 1 }}>{a.message}</span>
              <Badge tone={tone}>{a.severity}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
