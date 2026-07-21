// -----------------------------------------------------------------------------
// 9. Motor de Compra Inteligente (módulo central)
// Qué comprar, cuándo comprarlo y cuánto comprar.
// -----------------------------------------------------------------------------
import { VEN_WEIGHT } from './classification';
import type { VenClass } from './enums';

/** Consumo Diario Promedio (CDP) — media móvil de unidades consumidas por día. */
export function computeAverageDailyConsumption(
  dailyConsumption: number[]
): number {
  if (dailyConsumption.length === 0) return 0;
  const total = dailyConsumption.reduce((acc, v) => acc + v, 0);
  return total / dailyConsumption.length;
}

/** Desviación estándar (poblacional) de la demanda diaria. */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface SafetyStockInput {
  demandStdDev: number; // desviación estándar de la demanda diaria
  leadTimeDays: number; // TE
  ven: VenClass; // criticidad clínica → mayor SS para "Vital"
  serviceFactor?: number; // Z (nivel de servicio); por defecto ~95%
}

/**
 * Stock de Seguridad (SS) calculado dinámicamente:
 *   SS = Z * σ_demanda * sqrt(TE) * peso_VEN
 * El peso VEN amplifica la reserva para artículos vitales (tolerancia cero).
 */
export function computeSafetyStock(input: SafetyStockInput): number {
  const z = input.serviceFactor ?? 1.65; // ~95% de nivel de servicio
  const venWeight = VEN_WEIGHT[input.ven] ?? 1;
  // Normalizamos el peso VEN a un multiplicador 1.0 – 1.5.
  const venMultiplier = 1 + (venWeight - 1) * 0.25;
  const ss = z * input.demandStdDev * Math.sqrt(input.leadTimeDays) * venMultiplier;
  return Math.ceil(ss);
}

/** Punto de Pedido (PP / ROP): umbral de activación. PP = (CDP * TE) + SS */
export function computeReorderPoint(
  averageDailyConsumption: number,
  leadTimeDays: number,
  safetyStock: number
): number {
  return Math.ceil(averageDailyConsumption * leadTimeDays + safetyStock);
}

export interface EoqInput {
  averageDailyConsumption: number;
  moq: number; // Lote Mínimo de Compra
  maxStorageCapacity: number; // capacidad máxima en destino (unidades)
  currentUsefulStock: number;
  reorderPoint: number;
  reviewHorizonDays?: number; // cobertura objetivo tras la compra (def. 30)
}

/**
 * Lote Óptimo de Compra. En Fase 1 se aproxima equilibrando la necesidad real
 * (cobertura objetivo) contra el MOQ y la capacidad de almacenamiento.
 * En fases posteriores se incorporarán costos de pedido/almacenamiento (Wilson).
 */
export function computeOrderQuantity(input: EoqInput): number {
  const horizon = input.reviewHorizonDays ?? 30;
  // Necesidad para cubrir el horizonte y volver por encima del punto de pedido.
  const targetLevel =
    input.reorderPoint + input.averageDailyConsumption * horizon;
  let qty = Math.ceil(targetLevel - input.currentUsefulStock);

  if (qty <= 0) return 0;

  // Respetar el lote mínimo de compra (redondear hacia arriba al múltiplo de MOQ).
  if (input.moq > 1) {
    qty = Math.ceil(qty / input.moq) * input.moq;
  }

  // No exceder la capacidad de almacenamiento disponible en destino.
  if (input.maxStorageCapacity > 0) {
    const capacityHeadroom = input.maxStorageCapacity - input.currentUsefulStock;
    if (capacityHeadroom > 0) {
      qty = Math.min(qty, capacityHeadroom);
    }
  }

  return Math.max(0, qty);
}

// ---------------------------------------------------------------------------
// 9.4 Restricciones de almacenamiento / cadena de frío — división de entregas
// ---------------------------------------------------------------------------
export interface DeliverySplit {
  mainDelivery: number; // hasta llenar la capacidad disponible
  scheduledDeliveries: number[]; // entregas parciales del excedente
}

/**
 * Si la cantidad recomendada supera la capacidad disponible (p.ej. heladera),
 * el motor divide en una entrega principal más entregas parciales programadas.
 */
export function splitDeliveryByCapacity(
  recommendedQty: number,
  availableCapacity: number
): DeliverySplit {
  if (availableCapacity <= 0 || recommendedQty <= availableCapacity) {
    return { mainDelivery: recommendedQty, scheduledDeliveries: [] };
  }
  const mainDelivery = availableCapacity;
  let remainder = recommendedQty - availableCapacity;
  const scheduledDeliveries: number[] = [];
  while (remainder > 0) {
    const chunk = Math.min(availableCapacity, remainder);
    scheduledDeliveries.push(chunk);
    remainder -= chunk;
  }
  return { mainDelivery, scheduledDeliveries };
}

// ---------------------------------------------------------------------------
// Recomendación de compra completa para un ítem
// ---------------------------------------------------------------------------
export interface PurchaseRecommendationInput {
  itemId: string;
  itemName: string;
  ven: VenClass;
  usefulStock: number;
  dailyConsumptionHistory: number[]; // p.ej. últimos 30 días
  leadTimeDays: number;
  moq: number;
  maxStorageCapacity: number;
  availableStorageCapacity: number;
  refrigerated: boolean;
}

export interface PurchaseRecommendation {
  itemId: string;
  itemName: string;
  triggered: boolean;
  averageDailyConsumption: number;
  safetyStock: number;
  reorderPoint: number;
  usefulStock: number;
  recommendedQty: number;
  delivery: DeliverySplit;
  rationale: string;
}

/**
 * Evalúa un ítem contra el punto de pedido y produce una recomendación.
 * Lógica: SI (Useful_Stock <= PP) → ACTIVAR RECOMENDACIÓN_DE_COMPRA.
 */
export function buildRecommendation(
  input: PurchaseRecommendationInput
): PurchaseRecommendation {
  const cdp = computeAverageDailyConsumption(input.dailyConsumptionHistory);
  const sigma = standardDeviation(input.dailyConsumptionHistory);
  const safetyStock = computeSafetyStock({
    demandStdDev: sigma,
    leadTimeDays: input.leadTimeDays,
    ven: input.ven,
  });
  const reorderPoint = computeReorderPoint(cdp, input.leadTimeDays, safetyStock);
  const triggered = input.usefulStock <= reorderPoint;

  let recommendedQty = 0;
  let delivery: DeliverySplit = { mainDelivery: 0, scheduledDeliveries: [] };

  if (triggered) {
    recommendedQty = computeOrderQuantity({
      averageDailyConsumption: cdp,
      moq: input.moq,
      maxStorageCapacity: input.maxStorageCapacity,
      currentUsefulStock: input.usefulStock,
      reorderPoint,
    });
    // Restricción de cadena de frío / capacidad de destino.
    delivery = splitDeliveryByCapacity(
      recommendedQty,
      input.refrigerated
        ? input.availableStorageCapacity
        : Math.max(recommendedQty, input.availableStorageCapacity)
    );
  }

  const rationale =
    `CDP=${cdp.toFixed(2)} u/día · σ=${sigma.toFixed(2)} · TE=${input.leadTimeDays}d · ` +
    `SS=${safetyStock} · PP=${reorderPoint} · StockÚtil=${input.usefulStock}` +
    (triggered ? ` → recomendar ${recommendedQty} u` : ' → sin acción');

  return {
    itemId: input.itemId,
    itemName: input.itemName,
    triggered,
    averageDailyConsumption: Number(cdp.toFixed(2)),
    safetyStock,
    reorderPoint,
    usefulStock: input.usefulStock,
    recommendedQty,
    delivery,
    rationale,
  };
}
