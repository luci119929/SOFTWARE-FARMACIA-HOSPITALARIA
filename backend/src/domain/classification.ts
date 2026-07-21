// -----------------------------------------------------------------------------
// 6. Lógica de clasificación farmacológica — Matriz de prioridad ABC + VEN + FEFO
// -----------------------------------------------------------------------------
import type { AbcClass, VenClass } from './enums';

// Pesos de criticidad clínica (VEN). "Vital" tiene tolerancia cero a quiebres.
export const VEN_WEIGHT: Record<VenClass, number> = {
  V: 3, // Vital
  E: 2, // Esencial
  N: 1, // No esencial
};

// Pesos de impacto económico (ABC).
export const ABC_WEIGHT: Record<AbcClass, number> = {
  A: 3, // Alto valor financiero
  B: 2,
  C: 1,
};

export interface PriorityInput {
  abc: AbcClass;
  ven: VenClass;
  /** Días restantes hasta el vencimiento del lote más próximo (FEFO). */
  daysToNearestExpiry: number | null;
}

export interface PriorityResult {
  score: number; // 0..100 — mayor = más prioritario
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Combina ABC + VEN + proximidad de vencimiento (FEFO) en una puntuación única.
 * Un artículo "Clase A + Vital" próximo a vencer obtiene la puntuación más alta.
 */
export function computePriority(input: PriorityInput): PriorityResult {
  const abc = ABC_WEIGHT[input.abc] ?? 1;
  const ven = VEN_WEIGHT[input.ven] ?? 1;

  // Componente base: combinación económica-clínica (máx. 9 → normalizado a 60).
  const base = (abc * ven) / 9; // 0..1

  // Componente de urgencia por vencimiento: crece a medida que se acerca la fecha.
  let expiryUrgency = 0;
  if (input.daysToNearestExpiry !== null) {
    if (input.daysToNearestExpiry <= 0) {
      expiryUrgency = 1;
    } else {
      // 90 días o más → 0; 0 días → 1 (decaimiento lineal).
      expiryUrgency = Math.max(0, 1 - input.daysToNearestExpiry / 90);
    }
  }

  const score = Math.round(base * 60 + expiryUrgency * 40); // 0..100

  let band: PriorityResult['band'] = 'LOW';
  if (score >= 80) band = 'CRITICAL';
  else if (score >= 55) band = 'HIGH';
  else if (score >= 30) band = 'MEDIUM';

  return { score, band };
}
