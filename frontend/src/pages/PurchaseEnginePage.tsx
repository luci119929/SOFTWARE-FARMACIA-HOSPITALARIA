import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import { exportPurchaseOrderPdf } from '../utils/pdf';
import type { PoStatus, PurchaseOrder, Recommendation } from '../api/types';

const STATUS_LABELS: Record<PoStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada a aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

function statusTone(status: PoStatus) {
  if (status === 'APPROVED' || status === 'RECEIVED') return 'ok' as const;
  if (status === 'SUBMITTED') return 'info' as const;
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const;
  return 'muted' as const;
}

interface ReceiptLine {
  receivedQty: number;
  batchNumber: string;
  expirationDate: string;
  physicalLocation: string;
}

export function PurchaseEnginePage() {
  const { can } = useAuth();
  const recs = useApi<{ recommendations: Recommendation[]; evaluated: number }>(
    '/purchasing/recommendations'
  );
  const orders = useApi<{ orders: PurchaseOrder[] }>('/purchasing/orders');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiptLines, setReceiptLines] = useState<Record<string, ReceiptLine>>({});

  const canManage = can(P.PURCHASING_MANAGE);
  const canApprove = can(P.PURCHASING_APPROVE);
  const canReceive = can(P.INVENTORY_SUPPLY);

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
          ? `Orden consolidada: se actualizó la orden en borrador existente para ${rec.itemName}.`
          : `Nueva orden de compra generada (borrador) para ${rec.itemName}.`
      );
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al generar la orden');
    } finally {
      setBusy(null);
    }
  }

  async function submit(order: PurchaseOrder) {
    setBusy(order.id);
    setMsg(null);
    try {
      await api.post(`/purchasing/orders/${order.id}/submit`);
      setMsg(`Orden ${order.code} enviada a aprobación.`);
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al enviar la orden');
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

  function openReject(order: PurchaseOrder) {
    setRejectingId(order.id);
    setRejectReason('');
    setMsg(null);
  }

  async function submitReject(order: PurchaseOrder, e: React.FormEvent) {
    e.preventDefault();
    setBusy(order.id);
    setMsg(null);
    try {
      await api.post(`/purchasing/orders/${order.id}/reject`, { reason: rejectReason });
      setMsg(`Orden ${order.code} rechazada.`);
      setRejectingId(null);
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al rechazar la orden');
    } finally {
      setBusy(null);
    }
  }

  function openReceive(order: PurchaseOrder) {
    setReceivingId(order.id);
    setMsg(null);
    const initial: Record<string, ReceiptLine> = {};
    for (const line of order.lines) {
      const pending = line.orderedQty - line.receivedQty;
      if (pending > 0) {
        initial[line.id] = { receivedQty: pending, batchNumber: '', expirationDate: '', physicalLocation: '' };
      }
    }
    setReceiptLines(initial);
  }

  function updateReceiptLine(lineId: string, patch: Partial<ReceiptLine>) {
    setReceiptLines((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  async function submitReceive(order: PurchaseOrder, e: React.FormEvent) {
    e.preventDefault();
    setBusy(order.id);
    setMsg(null);
    try {
      const lines = Object.entries(receiptLines).map(([lineId, l]) => ({
        lineId,
        receivedQty: l.receivedQty,
        batchNumber: l.batchNumber,
        expirationDate: l.expirationDate,
        physicalLocation: l.physicalLocation,
      }));
      await api.post(`/purchasing/orders/${order.id}/receive`, { lines });
      setMsg(`Recepción registrada para la orden ${order.code}.`);
      setReceivingId(null);
      orders.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Error al registrar la recepción');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Motor de Compra Inteligente</h1>
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
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.code}</td>
                  <td>
                    <Badge tone={statusTone(o.status)}>{STATUS_LABELS[o.status]}</Badge>
                    {o.status === 'REJECTED' && o.rejectionReason && (
                      <div className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>{o.rejectionReason}</div>
                    )}
                  </td>
                  <td>{o.supplier?.name ?? <span className="muted">Sin asignar</span>}</td>
                  <td>
                    {o.lines.map((l) => (
                      <div key={l.id} style={{ fontSize: '0.85rem' }}>
                        {l.item.name} · <strong>{l.orderedQty} u</strong>
                        {o.status === 'APPROVED' || o.status === 'RECEIVED' ? (
                          <span className="muted"> ({l.receivedQty}/{l.orderedQty} recibido)</span>
                        ) : null}
                      </div>
                    ))}
                  </td>
                  <td>{o.createdBy?.fullName ?? '—'}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => exportPurchaseOrderPdf(o)}>
                        PDF
                      </button>
                      {canManage && o.status === 'DRAFT' && (
                        <button className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => submit(o)}>
                          Enviar a aprobación
                        </button>
                      )}
                      {canApprove && o.status === 'SUBMITTED' && (
                        <>
                          <button className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => approve(o)}>
                            Aprobar
                          </button>
                          <button className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => openReject(o)}>
                            Rechazar
                          </button>
                        </>
                      )}
                      {canReceive && o.status === 'APPROVED' && (
                        <button className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => openReceive(o)}>
                          Registrar recepción
                        </button>
                      )}
                      {!(
                        (canManage && o.status === 'DRAFT') ||
                        (canApprove && o.status === 'SUBMITTED') ||
                        (canReceive && o.status === 'APPROVED')
                      ) && <span className="muted">—</span>}
                    </div>

                    {rejectingId === o.id && (
                      <form className="card card-pad mt-16" onSubmit={(e) => submitReject(o, e)}>
                        <div className="field">
                          <label>Motivo del rechazo</label>
                          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn btn-primary btn-sm" disabled={busy === o.id}>Confirmar rechazo</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejectingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}

                    {receivingId === o.id && (
                      <form className="card card-pad mt-16" onSubmit={(e) => submitReceive(o, e)}>
                        {o.lines
                          .filter((l) => l.orderedQty - l.receivedQty > 0)
                          .map((l) => {
                            const rl = receiptLines[l.id];
                            if (!rl) return null;
                            return (
                              <div key={l.id} style={{ marginBottom: 14 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  {l.item.name} · pendiente {l.orderedQty - l.receivedQty} u
                                </div>
                                <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                                  <input
                                    type="number"
                                    min={1}
                                    max={l.orderedQty - l.receivedQty}
                                    placeholder="Cantidad"
                                    style={{ maxWidth: 110 }}
                                    value={rl.receivedQty}
                                    onChange={(e) => updateReceiptLine(l.id, { receivedQty: Number(e.target.value) })}
                                    required
                                  />
                                  <input
                                    placeholder="Nº de lote"
                                    style={{ maxWidth: 140 }}
                                    value={rl.batchNumber}
                                    onChange={(e) => updateReceiptLine(l.id, { batchNumber: e.target.value })}
                                    required
                                  />
                                  <input
                                    type="date"
                                    style={{ maxWidth: 160 }}
                                    value={rl.expirationDate}
                                    onChange={(e) => updateReceiptLine(l.id, { expirationDate: e.target.value })}
                                    required
                                  />
                                  <input
                                    placeholder="Ubicación física"
                                    style={{ maxWidth: 160 }}
                                    value={rl.physicalLocation}
                                    onChange={(e) => updateReceiptLine(l.id, { physicalLocation: e.target.value })}
                                    required
                                  />
                                </div>
                              </div>
                            );
                          })}
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn btn-primary btn-sm" disabled={busy === o.id}>
                            {busy === o.id ? 'Registrando…' : 'Confirmar recepción'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReceivingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {orders.data.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
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
