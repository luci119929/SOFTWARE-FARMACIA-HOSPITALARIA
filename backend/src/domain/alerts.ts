// -----------------------------------------------------------------------------
// 8. Sistema de alertas automatizadas
// -----------------------------------------------------------------------------
import type { AlertSeverity, AlertType } from './enums';
import { standardDeviation } from './purchasing';

export interface AlertCandidate {
  itemId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
}

export interface StockAlertInput {
  itemId: string;
  itemName: string;
  currentStock: number;
  minimumThreshold: number;
  daysToNearestExpiry: number | null;
  expiryWindowDays: number; // ventana de riesgo de vencimiento
  dailyConsumptionHistory: number[];
  todayConsumption: number;
}

/**
 * Evalúa un ítem en tiempo real y devuelve las alertas que deben dispararse.
 * - Stock crítico: Current_Stock <= Minimum_Threshold
 * - Riesgo de vencimiento: dentro de la ventana previa al vencimiento
 * - Consumo anómalo: pico que supera la media + 2σ histórica
 * (La brecha de cadena de frío proviene de integraciones de hardware.)
 */
export function evaluateStockAlerts(input: StockAlertInput): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];

  if (input.currentStock <= input.minimumThreshold) {
    alerts.push({
      itemId: input.itemId,
      type: 'CRITICAL_STOCK',
      severity: 'CRITICAL',
      message: `Stock crítico: ${input.itemName} (${input.currentStock} ≤ umbral ${input.minimumThreshold}).`,
    });
  }

  if (
    input.daysToNearestExpiry !== null &&
    input.daysToNearestExpiry <= input.expiryWindowDays
  ) {
    alerts.push({
      itemId: input.itemId,
      type: 'EXPIRY_RISK',
      severity: input.daysToNearestExpiry <= 0 ? 'CRITICAL' : 'WARNING',
      message:
        input.daysToNearestExpiry <= 0
          ? `Producto vencido: ${input.itemName}.`
          : `Riesgo de vencimiento: ${input.itemName} vence en ${input.daysToNearestExpiry} días.`,
    });
  }

  if (input.dailyConsumptionHistory.length >= 5) {
    const mean =
      input.dailyConsumptionHistory.reduce((a, b) => a + b, 0) /
      input.dailyConsumptionHistory.length;
    const sigma = standardDeviation(input.dailyConsumptionHistory);
    if (sigma > 0 && input.todayConsumption > mean + 2 * sigma) {
      alerts.push({
        itemId: input.itemId,
        type: 'ANOMALOUS_CONSUMPTION',
        severity: 'WARNING',
        message: `Consumo anómalo: ${input.itemName} consumió ${input.todayConsumption} u hoy (media ${mean.toFixed(1)} ± ${sigma.toFixed(1)}).`,
      });
    }
  }

  return alerts;
}
