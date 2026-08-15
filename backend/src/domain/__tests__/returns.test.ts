import { describe, expect, it } from 'vitest';
import { suggestDisposition } from '../returns';

describe('suggestDisposition', () => {
  it('suggests RESTOCK for unused or wrongly dispensed returns', () => {
    expect(suggestDisposition('UNUSED')).toBe('RESTOCK');
    expect(suggestDisposition('WRONG_DISPENSE')).toBe('RESTOCK');
  });

  it('suggests RETURN_TO_SUPPLIER for a market recall', () => {
    expect(suggestDisposition('RECALL')).toBe('RETURN_TO_SUPPLIER');
  });

  it('suggests DISCARD for expired, damaged, or unclassified returns', () => {
    expect(suggestDisposition('EXPIRED')).toBe('DISCARD');
    expect(suggestDisposition('DAMAGED')).toBe('DISCARD');
    expect(suggestDisposition('OTHER')).toBe('DISCARD');
  });
});
