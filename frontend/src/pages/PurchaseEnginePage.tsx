import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { Recommendation, PurchaseOrder } from '../api/types';

export function PurchaseEnginePage() {
  const { can } = useAuth();
  const recs = useApi<{ recommendations: Recommendation[]; evaluated: number }>(
    '/purchasing/recommendations'
  );
  const orders = useApi<{ orders: PurchaseOrder[] }>('/purchasing/orders');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canManage = can(P.PURCHASING_MANAGE);
  const canApprove = can(P.PURCHASING_APPROVE);

  async function createOrder(rec: Recommendation) {
    setBusy(rec.itemId);
    setMsg(null);
    try {
      const res = await api.post<{ consolidated: boolean; orderId?: string }>('/purchasing/orders', {
        itemId: rec.itemId,
        recommendedQty: rec.recommendedQty,
        rationale: rec.rationale,
        supplierId: rec.supplierId,
      });
      setMsg(
        res.consolidated
          ? `Orden consolidada: se actualizó la orden abierta existente para ${rec.itemName}.`
          : `Nueva orden de compra generada para ${rec.itemName}.`
      );
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al generar la orden');
    } finally {
      setBusy(null);
    }
  }

  async function approve(order: PurchaseOrder) {
    setBusy(order.id);
    setMsg(null);
    try {
      await api.post(`/purchasing/orders/${order.id}/approve`);
      setMsg(`Orden ${order.code} aprobada.`);
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al aprobar la orden');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Motor de Compra Inteligente</h1>
        <p className="page-sub">
          Determina qué, cuándo y cuánto comprar. Evalúa el Stock Útil contra el
          Punto de Pedido (PP = CDP × TE + SS) y consolida órdenes para evitar duplicados.
        </p>
      </div>

      {msg && (
        <div className="card card-pad mt-16" style={{ borderColor: 'var(--brand-500)', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <h2 style={{ fontSize: '1.1rem' }}>
        Recomendaciones activas{' '}
        {recs.data && <span className="muted">({recs.data.recommendations.length} de {recs.data.evaluated} ítems)</span>}
      </h2>

      {recs.loading && <Loading />}
      {recs.error && <ErrorState message={recs.error} />}
      {recs.data && recs.data.recommendations.length === 0 && (
        <div className="card card-pad muted">
          Ningún artículo está por debajo de su punto de pedido. No se requieren compras.
        </div>
      )}

      <div className="grid-2 mt-16">
        {recs.data?.recommendations.map((rec) => (
          <div key={rec.itemId} className="card card-pad">
            <div className="row between">
              <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{rec.itemName}</div>
              <Badge tone="warn">Reponer</Badge>
            </div>

            <div className="engine-metrics">
              <Metric label="Stock útil" value={rec.usefulStock} />
              <Metric label="Punto de pedido" value={rec.reorderPoint} />
              <Metric label="Stock seguridad" value={rec.safetyStock} />
              <Metric label="CDP (u/día)" value={rec.averageDailyConsumption} />
            </div>

            <div className="engine-rec">
              <div>
                <div className="muted" style={{ fontSize: '0.78rem' }}>Cantidad recomendada</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--brand-500)' }}>
                  {rec.recommendedQty} u
                </div>
              </div>
              {rec.delivery.scheduledDeliveries.length > 0 && (
                <div className="engine-split">
                  <Badge tone="info">Cadena de frío</Badge>
                  <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    Entrega principal {rec.delivery.mainDelivery} u + parciales:{' '}
                    {rec.delivery.scheduledDeliveries.join(' · ')}
                  </div>
                </div>
              )}
            </div>

            <p className="muted mono" style={{ fontSize: '0.78rem', marginTop: 10 }}>{rec.rationale}</p>

            {canManage && (
              <button
                className="btn btn-primary btn-sm mt-16"
                disabled={busy === rec.itemId}
                onClick={() => createOrder(rec)}
              >
                {busy === rec.itemId ? 'Procesando…' : 'Generar / consolidar orden'}
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.1rem', marginTop: 32 }}>Órdenes de compra</h2>
      {orders.loading && <Loading />}
      {orders.data && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estado</th>
                <th>Proveedor</th>
                <th>Líneas</th>
                <th>Creada por</th>
                {canApprove && <th>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {orders.data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.code}</td>
                  <td>
                    <Badge
                      tone={o.status === 'APPROVED' ? 'ok' : o.status === 'OPEN' ? 'info' : 'muted'}
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td>{o.supplier?.name ?? <span className="muted">Sin asignar</span>}</td>
                  <td>
                    {o.lines.map((l) => (
                      <div key={l.id} style={{ fontSize: '0.85rem' }}>
                        {l.item.name} · <strong>{l.orderedQty} u</strong>
                      </div>
                    ))}
                  </td>
                  <td>{o.createdBy?.fullName ?? '—'}</td>
                  {canApprove && (
                    <td>
                      {(o.status === 'OPEN' || o.status === 'SUBMITTED') ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy === o.id}
                          onClick={() => approve(o)}
                        >
                          Aprobar
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {orders.data.orders.length === 0 && (
                <tr>
                  <td colSpan={canApprove ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    Aún no hay órdenes de compra.
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.74rem' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
