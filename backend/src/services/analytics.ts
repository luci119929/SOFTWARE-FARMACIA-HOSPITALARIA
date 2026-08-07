// -----------------------------------------------------------------------------
// Servicios de análisis derivados del libro de movimientos.
// Traduce eventos del ledger en series de consumo diario para el Motor de Compra
// y las alertas.
// -----------------------------------------------------------------------------
import { prisma } from '../db/prisma';

/**
 * Reconstruye el consumo diario (unidades despachadas por día) de un ítem a
 * partir de los movimientos de tipo EXIT en los últimos `days` días.
 * Devuelve un arreglo de longitud `days` (índice 0 = hace `days-1` días).
 */
export async function getDailyConsumption(
  itemId: string,
  days: number,
  now: Date = new Date()
): Promise<number[]> {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const movements = await prisma.movement.findMany({
    where: {
      itemId,
      movementType: 'EXIT',
      timestamp: { gte: start },
    },
    select: { timestamp: true, quantityDelta: true },
  });

  const buckets = new Array(days).fill(0);
  for (const m of movements) {
    const dayIndex = Math.floor(
      (m.timestamp.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayIndex >= 0 && dayIndex < days) {
      // quantityDelta de una salida es negativo → tomamos el valor absoluto.
      buckets[dayIndex] += Math.abs(m.quantityDelta);
    }
  }
  return buckets;
}
