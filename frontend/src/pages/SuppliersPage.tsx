import { useApi } from '../api/useApi';
import { Badge, ErrorState, Loading } from '../components/ui';

interface Supplier {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  leadTimeDays: number;
  isActive: boolean;
}

export function SuppliersPage() {
  const { data, loading, error } = useApi<{ suppliers: Supplier[] }>('/meta/suppliers');

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Proveedores</h1>
        <p className="page-sub">Datos logísticos que alimentan el Motor de Compra (Tiempo de Entrega).</p>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} />}
      {data && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Proveedor</th><th>Contacto</th><th>Lead Time (TE)</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {data.suppliers.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="muted">{s.contactEmail ?? '—'}</td>
                  <td><Badge tone="info">{s.leadTimeDays} días</Badge></td>
                  <td><Badge tone={s.isActive ? 'ok' : 'muted'}>{s.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                </tr>
              ))}
              {data.suppliers.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin proveedores.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
