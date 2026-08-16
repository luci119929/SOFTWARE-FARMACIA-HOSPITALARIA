import { Fragment, useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { Supplier, SupplierPurchaseHistory } from '../api/types';

const emptyForm = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  taxId: '',
  paymentTerms: '',
  notes: '',
  leadTimeDays: 7,
};

export function SuppliersPage() {
  const { can } = useAuth();
  const suppliers = useApi<{ suppliers: Supplier[] }>('/suppliers');
  const canManage = can(P.SUPPLIERS_MANAGE);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<SupplierPurchaseHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  function startCreate() {
    setEditingId('new');
    setForm(emptyForm);
    setMsg(null);
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      contactName: s.contactName ?? '',
      contactEmail: s.contactEmail ?? '',
      contactPhone: s.contactPhone ?? '',
      address: s.address ?? '',
      taxId: s.taxId ?? '',
      paymentTerms: s.paymentTerms ?? '',
      notes: s.notes ?? '',
      leadTimeDays: s.leadTimeDays,
    });
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editingId === 'new') {
        await api.post('/suppliers', form);
        setMsg('Proveedor creado.');
      } else if (editingId) {
        await api.patch(`/suppliers/${editingId}`, form);
        setMsg('Proveedor actualizado.');
      }
      setEditingId(null);
      suppliers.reload();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al guardar el proveedor');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api.del(`/suppliers/${id}`);
      suppliers.reload();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al dar de baja');
    } finally {
      setBusy(false);
    }
  }

  async function viewHistory(id: string) {
    if (historyId === id) {
      setHistoryId(null);
      setHistory(null);
      return;
    }
    setHistoryId(id);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const res = await api.get<{
        supplierId: string;
        totalOrders: number;
        totalUnitsOrdered: number;
        countByStatus: Record<string, number>;
        nominalLeadTimeDays: number;
        averageActualLeadTimeDays: number | null;
      }>(`/suppliers/${id}/purchase-history`);
      setHistory(res);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Proveedores</h1>
      </div>

      <div className="grid-2">
        <div>
          {suppliers.loading && <Loading />}
          {suppliers.error && <ErrorState message={suppliers.error} />}
          {suppliers.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Contacto</th>
                    <th>Lead Time (TE)</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.data.suppliers.map((s) => (
                    <Fragment key={s.id}>
                      <tr>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td className="muted">{s.contactEmail ?? '—'}</td>
                        <td><Badge tone="info">{s.leadTimeDays} días</Badge></td>
                        <td><Badge tone={s.isActive ? 'ok' : 'muted'}>{s.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => viewHistory(s.id)}>
                              {historyId === s.id ? 'Ocultar' : 'Historial'}
                            </button>
                            {canManage && (
                              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>
                                Editar
                              </button>
                            )}
                            {canManage && s.isActive && (
                              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => deactivate(s.id)}>
                                Dar de baja
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {historyId === s.id && (
                        <tr>
                          <td colSpan={5}>
                            {historyLoading && <Loading label="Cargando historial…" />}
                            {history && (
                              <div className="row wrap" style={{ gap: 20, padding: '10px 4px' }}>
                                <span className="muted">Órdenes totales: <strong style={{ color: 'var(--text)' }}>{history.totalOrders}</strong></span>
                                <span className="muted">Unidades pedidas: <strong style={{ color: 'var(--text)' }}>{history.totalUnitsOrdered}</strong></span>
                                <span className="muted">TE nominal: <strong style={{ color: 'var(--text)' }}>{history.nominalLeadTimeDays} d</strong></span>
                                <span className="muted">
                                  TE real promedio: <strong style={{ color: 'var(--text)' }}>{history.averageActualLeadTimeDays ?? '—'}{history.averageActualLeadTimeDays !== null ? ' d' : ''}</strong>
                                </span>
                                <span className="row" style={{ gap: 6 }}>
                                  {Object.entries(history.countByStatus).map(([status, count]) => (
                                    <Badge key={status} tone="muted">{status}: {count}</Badge>
                                  ))}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {suppliers.data.suppliers.length === 0 && (
                    <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin proveedores.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage && (
          <div style={{ alignSelf: 'start' }}>
            {msg && !editingId && (
              <div className="card card-pad muted" style={{ marginBottom: 12 }}>{msg}</div>
            )}
            <div className="card card-pad">
            {editingId ? (
              <>
                <h2 style={{ fontSize: '1.05rem' }}>{editingId === 'new' ? 'Nuevo proveedor' : 'Editar proveedor'}</h2>
                <form onSubmit={submit}>
                  <div className="field">
                    <label>Nombre</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Contacto</label>
                    <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Correo</label>
                    <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Teléfono</label>
                    <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Dirección</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>CUIT / Tax ID</label>
                    <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Condiciones de pago</label>
                    <input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Tiempo de entrega (días)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.leadTimeDays}
                      onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Notas</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-primary" disabled={busy}>
                      {busy ? 'Guardando…' : editingId === 'new' ? 'Crear proveedor' : 'Guardar cambios'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <button className="btn btn-primary" onClick={startCreate}>Nuevo proveedor</button>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
