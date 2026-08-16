import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../api/useApi';
import { P } from '../rbac/permissions';
import { Badge, Stat } from '../components/ui';
import type { AlertItem, InventoryItem, Recommendation, PurchaseOrder } from '../api/types';

// Paleta fija (no depende de CSS custom properties: Recharts serializa los
// props de color en el SVG antes del pintado, y esta app sólo tiene tema oscuro).
const CHART_COLORS = {
  mint: '#00ffc2',
  red: '#ff5757',
  amber: '#ffbd58',
  green: '#7dd957',
  lavender: '#b7aee8',
  border: '#2a1d74',
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: CHART_COLORS.red,
  HIGH: CHART_COLORS.amber,
  MEDIUM: CHART_COLORS.mint,
  LOW: CHART_COLORS.lavender,
};
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: CHART_COLORS.red,
  WARNING: CHART_COLORS.amber,
  INFO: CHART_COLORS.mint,
};

const chartTooltipStyle = {
  background: '#1d1063',
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 8,
  color: '#ffffff',
  fontSize: '0.85rem',
};

export function DashboardPage() {
  const { user, can } = useAuth();
  if (!user) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Hola, {user.fullName.split(' ')[0]} 👋</h1>
      </div>

      {/* Farmacéutico / operativo: alertas, stock, movimientos */}
      {can(P.ALERTS_READ) && <AlertsSummary />}
      {can(P.INVENTORY_READ) && <InventorySummary />}

      {/* Compras / Jefe: recomendaciones y órdenes */}
      {can(P.PURCHASING_READ) && <PurchasingSummary />}

      {/* Análisis visual: distribución de prioridad, alertas y órdenes.
          Cada gráfico se activa por el permiso del recurso que consume, no
          sólo por analytics:read (que no implica alerts:read/purchasing:read). */}
      {can(P.ANALYTICS_READ) && (can(P.INVENTORY_READ) || can(P.ALERTS_READ) || can(P.PURCHASING_READ)) && (
        <Section title="Analítica">
          <div className="grid-2">
            {can(P.INVENTORY_READ) && <PriorityChart />}
            {can(P.ALERTS_READ) && <SeverityChart />}
            {can(P.PURCHASING_READ) && <PurchaseOrderStatusChart />}
          </div>
        </Section>
      )}

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
  const openOrders = (orders.data?.orders ?? []).filter(
    (o) => o.status === 'DRAFT' || o.status === 'SUBMITTED' || o.status === 'APPROVED'
  ).length;

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

function PriorityChart() {
  const items = useApi<{ items: InventoryItem[] }>('/inventory');
  const priorityData = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    .map((band) => ({
      name: band,
      value: (items.data?.items ?? []).filter((i) => i.priority.band === band).length,
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="card card-pad">
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
        Inventario por banda de prioridad (ABC + VEN + FEFO)
      </div>
      {priorityData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
              {priorityData.map((d) => (
                <Cell key={d.name} fill={PRIORITY_COLORS[d.name] ?? CHART_COLORS.lavender} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '0.78rem', color: CHART_COLORS.lavender }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="muted card-pad">Sin datos suficientes.</div>
      )}
    </div>
  );
}

function SeverityChart() {
  const alerts = useApi<{ alerts: AlertItem[] }>('/alerts');
  const severityData = ['CRITICAL', 'WARNING', 'INFO'].map((sev) => ({
    name: sev,
    value: (alerts.data?.alerts ?? []).filter((a) => a.severity === sev).length,
  }));

  return (
    <div className="card card-pad">
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
        Alertas activas por severidad
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={severityData}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis dataKey="name" tick={{ fill: CHART_COLORS.lavender, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: CHART_COLORS.lavender, fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {severityData.map((d) => (
              <Cell key={d.name} fill={SEVERITY_COLORS[d.name] ?? CHART_COLORS.mint} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PurchaseOrderStatusChart() {
  const orders = useApi<{ orders: PurchaseOrder[] }>('/purchasing/orders');
  const statusData = Object.entries(
    (orders.data?.orders ?? []).reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ name: status, value: count }));

  return (
    <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
        Órdenes de compra por estado
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={statusData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_COLORS.lavender, fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fill: CHART_COLORS.lavender, fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={CHART_COLORS.mint} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
