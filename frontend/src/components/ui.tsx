import type { ReactNode } from 'react';

// --- Badges de estado ------------------------------------------------------
type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';
export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Clasificación VEN → tono semántico.
export function VenBadge({ ven }: { ven: string }) {
  const tone: BadgeTone = ven === 'V' ? 'danger' : ven === 'E' ? 'warn' : 'muted';
  const label = ven === 'V' ? 'Vital' : ven === 'E' ? 'Esencial' : 'No esencial';
  return <Badge tone={tone}>{label}</Badge>;
}

export function AbcBadge({ abc }: { abc: string }) {
  const tone: BadgeTone = abc === 'A' ? 'info' : abc === 'B' ? 'muted' : 'muted';
  return <Badge tone={tone}>Clase {abc}</Badge>;
}

export function PriorityBadge({ band, score }: { band: string; score: number }) {
  const tone: BadgeTone =
    band === 'CRITICAL' ? 'danger' : band === 'HIGH' ? 'warn' : band === 'MEDIUM' ? 'info' : 'muted';
  return <Badge tone={tone}>{score}</Badge>;
}

// --- Stat tile -------------------------------------------------------------
const accentVar: Record<string, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--brand-500)',
};
export function Stat({
  label,
  value,
  accent = 'info',
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: 'ok' | 'warn' | 'danger' | 'info';
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>{hint}</div>}
      <div className="stat-accent-bar" style={{ background: accentVar[accent] }} />
    </div>
  );
}

// --- Estados de carga / vacío ---------------------------------------------
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <div className="muted card card-pad">{label}</div>;
}
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="muted card card-pad">{children}</div>;
}
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card card-pad" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
      {message}
    </div>
  );
}
