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

// --- Stat tile (tarjeta con contorno y número neón, estilo de marca) -------
const accentVar: Record<string, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--accent)',
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
  const color = accentVar[accent];
  return (
    <div className="stat" style={{ borderColor: color }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>{hint}</div>}
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
