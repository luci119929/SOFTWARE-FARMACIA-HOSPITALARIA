// -----------------------------------------------------------------------------
// 7. Lógica avanzada de inventario — FEFO y Stock Útil
// -----------------------------------------------------------------------------

export interface BatchView {
  id: string;
  batchNumber: string;
  expirationDate: Date;
  availableQty: number;
  physicalLocation: string;
}

/** Días entre hoy y una fecha (negativo si ya venció). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const ms = date.getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Ordena lotes según FEFO (First Expired, First Out): primero los que vencen
 * antes. Es el orden en que el sistema debe despachar físicamente.
 */
export function orderByFefo(batches: BatchView[]): BatchView[] {
  return [...batches].sort(
    (a, b) => a.expirationDate.getTime() - b.expirationDate.getTime()
  );
}

export interface UsefulStockResult {
  totalStock: number;
  usefulStock: number; // no vence dentro de la ventana de riesgo
  atRiskStock: number; // vence dentro de la ventana de riesgo
  nearestExpiry: Date | null;
  daysToNearestExpiry: number | null;
}

/**
 * Algoritmo de Stock Útil (sección 7).
 * Total_Stock = Useful_Stock + At_Risk_Stock
 * El stock "en riesgo" es el que vence dentro de `riskWindowDays`. El Motor de
 * Compra observa el Stock Útil, no el total, para prevenir faltantes.
 */
export function computeUsefulStock(
  batches: BatchView[],
  riskWindowDays: number,
  now: Date = new Date()
): UsefulStockResult {
  let totalStock = 0;
  let atRiskStock = 0;
  let nearestExpiry: Date | null = null;

  for (const batch of batches) {
    totalStock += batch.availableQty;
    const days = daysUntil(batch.expirationDate, now);
    if (days <= riskWindowDays) {
      atRiskStock += batch.availableQty;
    }
    if (!nearestExpiry || batch.expirationDate < nearestExpiry) {
      nearestExpiry = batch.expirationDate;
    }
  }

  return {
    totalStock,
    usefulStock: totalStock - atRiskStock,
    atRiskStock,
    nearestExpiry,
    daysToNearestExpiry: nearestExpiry ? daysUntil(nearestExpiry, now) : null,
  };
}

/**
 * Plan de despacho FEFO para una cantidad solicitada. Devuelve de qué lotes
 * tomar unidades, respetando el orden de vencimiento.
 */
export function planFefoDispatch(
  batches: BatchView[],
  requestedQty: number
): { allocations: { batchId: string; qty: number }[]; shortfall: number } {
  const ordered = orderByFefo(batches);
  const allocations: { batchId: string; qty: number }[] = [];
  let remaining = requestedQty;

  for (const batch of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(batch.availableQty, remaining);
    if (take > 0) {
      allocations.push({ batchId: batch.id, qty: take });
      remaining -= take;
    }
  }

  return { allocations, shortfall: Math.max(0, remaining) };
}
