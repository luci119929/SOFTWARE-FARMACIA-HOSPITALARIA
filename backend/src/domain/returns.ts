// -----------------------------------------------------------------------------
// Devoluciones y logística inversa.
// -----------------------------------------------------------------------------
import type { ReturnDisposition, ReturnReason } from './enums';

/**
 * Disposición sugerida por defecto según el motivo de la devolución.
 * El usuario que procesa la devolución puede sobreescribirla.
 */
export function suggestDisposition(reason: ReturnReason): ReturnDisposition {
  if (reason === 'UNUSED' || reason === 'WRONG_DISPENSE') return 'RESTOCK';
  if (reason === 'RECALL') return 'RETURN_TO_SUPPLIER';
  return 'DISCARD'; // EXPIRED, DAMAGED, OTHER
}
