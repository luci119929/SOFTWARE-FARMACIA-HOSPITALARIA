import { useMemo, useState } from 'react';
import { useApi } from '../api/useApi';
import { AbcBadge, Badge, ErrorState, Loading, PriorityBadge, VenBadge } from '../components/ui';
import type { InventoryItem } from '../api/types';

function expiryTone(days: number | null): 'ok' | 'warn' | 'danger' {
  if (days === null) return 'ok';
  if (days <= 0) return 'danger';
  if (days <= 30) return 'warn';
  return 'ok';
}

export function InventoryPage() {
  const { data, loading, error } = useApi<{ items: InventoryItem[] }>('/inventory');
  const [query, setQuery] = useState('');
  const [ven, setVen] = useState('');

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.activeIngredient.toLowerCase().includes(q)
      );
    }
    if (ven) list = list.filter((i) => i.venClassification === ven);
    return list;
  }, [data, query, ven]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Inventario</h1>
        <p className="page-sub">
          Trazabilidad por lote, Stock Útil (excluye lo próximo a vencer) y prioridad ABC + VEN + FEFO.
        </p>
      </div>

      <div className="row wrap" style={{ marginBottom: 16, gap: 12 }}>
        <input
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nombre o principio activo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={{ maxWidth: 200 }} value={ven} onChange={(e) => setVen(e.target.value)}>
          <option value="">Todas las clases VEN</option>
          <option value="V">Vital</option>
          <option value="E">Esencial</option>
          <option value="N">No esencial</option>
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Medicamento</th>
                <th>Clasificación</th>
                <th>Stock útil / total</th>
                <th>En riesgo</th>
                <th>Vence en</th>
                <th>Almacenamiento</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <PriorityBadge band={it.priority.band} score={it.priority.score} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {it.activeIngredient} · {it.concentration}
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <AbcBadge abc={it.abcClassification} />
                      <VenBadge ven={it.venClassification} />
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          it.stock.totalStock <= it.minimumThreshold
                            ? 'var(--danger)'
                            : 'var(--text)',
                      }}
                    >
                      {it.stock.usefulStock}
                    </span>
                    <span className="muted"> / {it.stock.totalStock}</span>
                  </td>
                  <td>
                    {it.stock.atRiskStock > 0 ? (
                      <Badge tone="warn">{it.stock.atRiskStock} u</Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {it.stock.daysToNearestExpiry !== null ? (
                      <Badge tone={expiryTone(it.stock.daysToNearestExpiry)}>
                        {it.stock.daysToNearestExpiry <= 0
                          ? 'Vencido'
                          : `${it.stock.daysToNearestExpiry} d`}
                      </Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={it.storageCondition === 'REFRIGERATED' ? 'info' : 'muted'}>
                      {it.storageCondition === 'REFRIGERATED' ? '❄ Refrigerado' : 'Ambiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
