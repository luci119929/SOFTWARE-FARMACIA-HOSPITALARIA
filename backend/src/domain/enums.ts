// Valores "enum" validados en la capa de dominio (portables con SQLite).

export const ABC_CLASSES = ['A', 'B', 'C'] as const;
export type AbcClass = (typeof ABC_CLASSES)[number];

export const VEN_CLASSES = ['V', 'E', 'N'] as const;
export type VenClass = (typeof VEN_CLASSES)[number];

export const STORAGE_CONDITIONS = ['AMBIENT', 'REFRIGERATED'] as const;
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];

export const MOVEMENT_TYPES = [
  'ENTRY', // Entrada
  'EXIT', // Salida
  'ADJUSTMENT', // Ajuste de inventario
  'RETURN', // Devolución
  'INTERNAL_TRANSFER', // Traslado interno
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const ALERT_TYPES = [
  'CRITICAL_STOCK',
  'EXPIRY_RISK',
  'COLD_CHAIN_BREACH',
  'ANOMALOUS_CONSUMPTION',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const PO_STATUSES = [
  'OPEN',
  'SUBMITTED',
  'APPROVED',
  'RECEIVED',
  'CANCELLED',
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
