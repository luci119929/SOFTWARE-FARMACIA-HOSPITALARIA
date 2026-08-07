import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../api/useApi';
import { P } from '../rbac/permissions';
import { Badge, Stat } from '../components/ui';
import type { AlertItem, InventoryItem, Recommendation, PurchaseOrder } from '../api/types';

export function DashboardPage() {
  const { user, can } = useAuth();
  if (!user) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Hola, {user.fullName.split(' ')[0]} 👋</h1>
        <p className="page-sub">
          Panel de {user.role.name}. Vista adaptada a tus permisos.
        </p>
      </div>

      {/* Farmacéutico / operativo: alertas, stock, movimientos */}
      {can(P.ALERTS_READ) && <AlertsSummary />}
      {can(P.INVENTORY_READ) && <InventorySummary />}

      {/* Compras / Jefe: recomendaciones y órdenes */}
      {can(P.PURCHASING_READ) && <PurchasingSummary />}

      {/* Administrador: salud del sistema y usuarios */}
      {can(P.USERS_READ) && <AdminSummary />}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-24">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AlertsSummary() {
  const { data } = useApi<{ alerts: AlertItem[] }>('/alerts');
  const alerts = data?.alerts ?? [];
  const critical = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warnings = alerts.filter((a) => a.severity === 'WARNING').length;

  return (
    <Section title="Alertas accionables" action={<Link className="btn btn-ghost btn-sm" to="/alertas">Ver todas</Link>}>
      <div className="stat-grid">
        <Stat label="Alertas críticas" value={critical} accent="danger" hint="Quiebres / vencidos" />
        <Stat label="Advertencias" value={warnings} accent="warn" hint="Riesgo de vencimiento / consumo" />
        <Stat label="Total activas" value={alerts.length} accent="info" />
      </div>
      <div className="card mt-16" style={{ overflow: 'hidden' }}>
        {alerts.slice(0, 4).map((a, i) => (
          <div
            key={i}
            className="row"
            style={{ padding: '12px 16px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', gap: 12 }}
          >
            <Badge tone={a.severity === 'CRITICAL' ? 'danger' : a.severity === 'WARNING' ? 'warn' : 'info'}>
              {a.severity}
            </Badge>
            <span>{a.message}</span>
          </div>
        ))}
        {alerts.length === 0 && <div className="card-pad muted">Sin alertas activas. Todo en orden.</div>}
      </div>
    </Section>
  );
}

function InventorySummary() {
  const { data } = useApi<{ items: InventoryItem[] }>('/inventory');
  const items = data?.items ?? [];
  const critical = items.filter((i) => i.stock.totalStock <= i.minimumThreshold).length;
  const atRisk = items.filter((i) => i.stock.atRiskStock > 0).length;

  return (
    <Section title="Estado del inventario" action={<Link className="btn btn-ghost btn-sm" to="/inventario">Ver inventario</Link>}>
      <div className="stat-grid">
        <Stat label="Artículos" value={items.length} accent="info" />
        <Stat label="Bajo umbral" value={critical} accent={critical ? 'danger' : 'ok'} hint="Stock crítico" />
        <Stat label="Con stock en riesgo" value={atRisk} accent={atRisk ? 'warn' : 'ok'} hint="Próximos a vencer" />
      </div>
    </Section>
  );
}

function PurchasingSummary() {
  const recs = useApi<{ recommendations: Recommendation[]; evaluated: number }>('/purchasing/recommendations');
  const orders = useApi<{ orders: PurchaseOrder[] }>('/purchasing/orders');
  const openOrders = (orders.data?.orders ?? []).filter((o) => o.status === 'OPEN').length;

  return (
    <Section title="Motor de Compra" action={<Link className="btn btn-ghost btn-sm" to="/motor-compra">Abrir motor</Link>}>
      <div className="stat-grid">
        <Stat label="Recomendaciones activas" value={recs.data?.recommendations.length ?? '—'} accent="warn" hint="Bajo el punto de pedido" />
        <Stat label="Órdenes abiertas" value={openOrders} accent="info" />
        <Stat label="Ítems evaluados" value={recs.data?.evaluated ?? '—'} accent="ok" />
      </div>
    </Section>
  );
}

function AdminSummary() {
  const users = useApi<{ users: { isActive: boolean }[] }>('/users');
  const active = (users.data?.users ?? []).filter((u) => u.isActive).length;

  return (
    <Section title="Salud del sistema" action={<Link className="btn btn-ghost btn-sm" to="/usuarios">Gestionar usuarios</Link>}>
      <div className="stat-grid">
        <Stat label="Usuarios activos" value={active} accent="ok" />
        <Stat label="Total usuarios" value={users.data?.users.length ?? '—'} accent="info" />
        <Stat label="API" value="En línea" accent="ok" />
      </div>
    </Section>
  );
}
