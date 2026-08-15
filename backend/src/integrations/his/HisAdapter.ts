// -----------------------------------------------------------------------------
// Integración con el Sistema de Información Hospitalaria (HIS).
// Define el contrato que cualquier HIS real (HL7v2, FHIR, REST propietario…)
// deberá implementar para enchufarse a MedLine. Hoy sólo existe MockHisAdapter
// (ver ./MockHisAdapter.ts): no hay un HIS concreto asignado todavía, así que
// esta capa deja la costura lista sin bloquear el resto del producto.
// -----------------------------------------------------------------------------

export interface HisStatus {
  connected: boolean;
  latencyMs: number;
  details: string;
}

export interface DispenseEvent {
  patientMrn: string;
  itemName: string;
  quantity: number;
  dispensedAt: Date;
}

export interface HisAdapter {
  /** Identifica el sistema al que se conecta (para mostrar en la UI de estado). */
  readonly name: string;

  /** Verifica conectividad/salud del HIS. */
  checkStatus(): Promise<HisStatus>;

  /** Trae pacientes nuevos/actualizados desde el HIS y los upsertea localmente. */
  syncPatients(): Promise<{ synced: number; details: string }>;

  /** Trae prescripciones nuevas desde el HIS y las registra como entradas de historia clínica. */
  syncPrescriptions(): Promise<{ synced: number; details: string }>;

  /** Notifica al HIS que se dispensó una medicación (evento saliente, HIS ← MedLine). */
  pushDispenseEvent(event: DispenseEvent): Promise<{ acknowledged: boolean }>;
}
