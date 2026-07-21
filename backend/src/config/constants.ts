// Parámetros de negocio configurables (Fase 1: valores por defecto).
export const BUSINESS_CONFIG = {
  /** Ventana (días) para considerar stock "en riesgo" de vencer. */
  expiryRiskWindowDays: 30,
  /** Ventana (días) para alertas de riesgo de vencimiento. */
  expiryAlertWindowDays: 60,
  /** Horizonte de cobertura objetivo tras una compra. */
  purchaseCoverageHorizonDays: 30,
  /** Historial de consumo considerado para el CDP (media móvil). */
  consumptionHistoryDays: 30,
};
