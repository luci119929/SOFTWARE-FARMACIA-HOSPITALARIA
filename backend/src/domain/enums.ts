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
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'CANCELLED',
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

// Devoluciones y logística inversa
export const RETURN_REASONS = [
  'EXPIRED', // Vencido
  'DAMAGED', // Dañado
  'UNUSED', // No utilizado
  'WRONG_DISPENSE', // Dispensado por error
  'RECALL', // Retiro del mercado
  'OTHER',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_DISPOSITIONS = [
  'RESTOCK', // Reingresa al stock
  'DISCARD', // Se descarta
  'RETURN_TO_SUPPLIER', // Se devuelve/canjea con el proveedor
] as const;
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

export const RETURN_STATUSES = ['PENDING', 'PROCESSED', 'REJECTED'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

// Historia clínica (orientada a farmacia: prescripciones y notas asociadas a
// la dispensación, no un EHR generalista — eso sigue siendo responsabilidad
// del HIS del hospital).
export const PATIENT_SEX = ['M', 'F', 'X'] as const;
export type PatientSex = (typeof PATIENT_SEX)[number];

export const CLINICAL_ENTRY_TYPES = [
  'DIAGNOSIS', // Diagnóstico
  'PRESCRIPTION', // Prescripción / indicación médica
  'NOTE', // Nota clínica general
  'ALLERGY_UPDATE', // Actualización de alergias
] as const;
export type ClinicalEntryType = (typeof CLINICAL_ENTRY_TYPES)[number];
