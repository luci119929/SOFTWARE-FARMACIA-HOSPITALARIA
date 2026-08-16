import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { InventoryItem, ReturnDisposition, ReturnReason, StockReturn } from '../api/types';

const REASON_LABELS: Record<ReturnReason, string> = {
  EXPIRED: 'Vencido',
  DAMAGED: 'Dañado',
  UNUSED: 'No utilizado',
  WRONG_DISPENSE: 'Dispensado por error',
  RECALL: 'Retiro del mercado',
  OTHER: 'Otro',
};

const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
  RESTOCK: 'Reingresar a stock',
  DISCARD: 'Descartar',
  RETURN_TO_SUPPLIER: 'Devolver al proveedor',
};

function statusTone(status: string) {
  if (status === 'PENDING') return 'warn' as const;
  if (status === 'PROCESSED') return 'ok' as const;
  return 'muted' as const;
}

export function ReturnsPage() {
  const { can } = useAuth();
  const returns = useApi<{ returns: StockReturn[] }>('/returns');
  const items = useApi<{ items: InventoryItem[] }>('/inventory');
  const canCreate = can(P.RETURNS_CREATE);
  const canProcess = can(P.RETURNS_PROCESS);

  const [form, setForm] = useState({
    itemId: '',
    quantity: 1,
    reason: 'UNUSED' as ReturnReason,
    sourceLocation: '',
    note: '',
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [processForm, setProcessForm] = useState({
    disposition: 'RESTOCK' as ReturnDisposition,
    batchNumber: '',
    expirationDate: '',
    physicalLocation: '',
    note: '',
  });

  async function createReturn(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateMsg(null);
    try {
      await api.post('/returns', form);
      setCreateMsg('Devolución registrada como pendiente.');
      setForm({ itemId: '', quantity: 1, reason: 'UNUSED', sourceLocation: '', note: '' });
      returns.reload();
    } catch (err) {
      setCreateMsg(err instanceof ApiError ? err.message : 'Error al registrar la devolución');
    } finally {
      setCreateBusy(false);
    }
  }

  function openProcess(id: string) {
    setProcessingId(id);
    setActionMsg(null);
    setProcessForm({
      disposition: 'RESTOCK',
      batchNumber: '',
      expirationDate: '',
      physicalLocation: '',
      note: '',
    });
  }

  async function submitProcess(id: string, e: React.FormEvent) {
    e.preventDefault();
    setBusy(id);
    setActionMsg(null);
    try {
      const body: Record<string, unknown> = { disposition: processForm.disposition, note: processForm.note || undefined };
      if (processForm.disposition === 'RESTOCK') {
        body.batchNumber = processForm.batchNumber;
        body.expirationDate = processForm.expirationDate;
        body.physicalLocation = processForm.physicalLocation;
      }
      await api.post(`/returns/${id}/process`, body);
      setActionMsg('Devolución procesada.');
      setProcessingId(null);
      returns.reload();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Error al procesar la devolución');
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    setBusy(id);
    setActionMsg(null);
    try {
      await api.post(`/returns/${id}/reject`);
      setActionMsg('Devolución rechazada.');
      returns.reload();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Error al rechazar la devolución');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Devoluciones</h1>
      </div>

      <div className="grid-2">
        <div>
          <h2 style={{ fontSize: '1.05rem' }}>Historial de devoluciones</h2>
          {returns.loading && <Loading />}
          {returns.error && <ErrorState message={returns.error} />}
          {actionMsg && <div className="muted" style={{ marginBottom: 10 }}>{actionMsg}</div>}
          {returns.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Ítem</th>
                    <th>Cant.</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    {canProcess && <th>Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {returns.data.returns.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.code}</td>
                      <td>{r.item.name}</td>
                      <td>{r.quantity}</td>
                      <td className="muted">{REASON_LABELS[r.reason]}</td>
                      <td>
                        <Badge tone={statusTone(r.status)}>
                          {r.status === 'PENDING' ? 'Pendiente' : r.status === 'PROCESSED' ? DISPOSITION_LABELS[r.disposition!] : 'Rechazada'}
                        </Badge>
                      </td>
                      {canProcess && (
                        <td>
                          {r.status === 'PENDING' ? (
                            <div className="row" style={{ gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => openProcess(r.id)}>
                                Procesar
                              </button>
                              <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => reject(r.id)}>
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {returns.data.returns.length === 0 && (
                    <tr>
                      <td colSpan={canProcess ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                        Sin devoluciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {processingId && (
            <div className="card card-pad mt-16">
              <h2 style={{ fontSize: '1rem' }}>Procesar devolución</h2>
              <form onSubmit={(e) => submitProcess(processingId, e)}>
                <div className="field">
                  <label>Disposición</label>
                  <select
                    value={processForm.disposition}
                    onChange={(e) => setProcessForm({ ...processForm, disposition: e.target.value as ReturnDisposition })}
                  >
                    {Object.entries(DISPOSITION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {processForm.disposition === 'RESTOCK' && (
                  <>
                    <div className="field">
                      <label>Número de lote</label>
                      <input
                        value={processForm.batchNumber}
                        onChange={(e) => setProcessForm({ ...processForm, batchNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Fecha de vencimiento</label>
                      <input
                        type="date"
                        value={processForm.expirationDate}
                        onChange={(e) => setProcessForm({ ...processForm, expirationDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label>Ubicación física</label>
                      <input
                        value={processForm.physicalLocation}
                        onChange={(e) => setProcessForm({ ...processForm, physicalLocation: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="field">
                  <label>Nota (opcional)</label>
                  <textarea
                    value={processForm.note}
                    onChange={(e) => setProcessForm({ ...processForm, note: e.target.value })}
                  />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy === processingId}>
                    {busy === processingId ? 'Procesando…' : 'Confirmar'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setProcessingId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {canCreate && (
          <div className="card card-pad" style={{ alignSelf: 'start' }}>
            <h2 style={{ fontSize: '1.05rem' }}>Registrar devolución</h2>
            <form onSubmit={createReturn}>
              <div className="field">
                <label>Medicamento</label>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {items.data?.items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="field">
                <label>Motivo</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value as ReturnReason })}
                >
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ubicación de origen (opcional)</label>
                <input
                  value={form.sourceLocation}
                  onChange={(e) => setForm({ ...form, sourceLocation: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nota (opcional)</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              {createMsg && <div className="muted" style={{ marginBottom: 10 }}>{createMsg}</div>}
              <button className="btn btn-primary" disabled={createBusy}>
                {createBusy ? 'Registrando…' : 'Registrar devolución'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
