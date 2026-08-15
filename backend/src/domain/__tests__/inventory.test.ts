import { describe, expect, it } from 'vitest';
import { computeUsefulStock, orderByFefo, planFefoDispatch, daysUntil } from '../inventory';
import type { BatchView } from '../inventory';

const NOW = new Date('2026-08-15T00:00:00.000Z');

function batch(overrides: Partial<BatchView>): BatchView {
  return {
    id: 'b1',
    batchNumber: 'L-1',
    expirationDate: new Date('2027-01-01'),
    availableQty: 10,
    physicalLocation: 'A1',
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('is negative for dates in the past', () => {
    expect(daysUntil(new Date('2026-08-10'), NOW)).toBeLessThan(0);
  });
  it('is positive for dates in the future', () => {
    expect(daysUntil(new Date('2026-09-15'), NOW)).toBeGreaterThan(0);
  });
});

describe('orderByFefo', () => {
  it('sorts batches by soonest expiration first, without mutating the input', () => {
    const batches = [
      batch({ id: 'late', expirationDate: new Date('2027-06-01') }),
      batch({ id: 'soon', expirationDate: new Date('2026-09-01') }),
      batch({ id: 'mid', expirationDate: new Date('2027-01-01') }),
    ];
    const ordered = orderByFefo(batches);
    expect(ordered.map((b) => b.id)).toEqual(['soon', 'mid', 'late']);
    expect(batches.map((b) => b.id)).toEqual(['late', 'soon', 'mid']); // original untouched
  });
});

describe('computeUsefulStock', () => {
  it('splits stock into useful vs. at-risk based on the risk window', () => {
    const batches = [
      batch({ id: 'safe', availableQty: 100, expirationDate: new Date('2027-06-01') }),
      batch({ id: 'risky', availableQty: 30, expirationDate: new Date('2026-08-20') }), // 5 days out
    ];
    const result = computeUsefulStock(batches, 30, NOW);
    expect(result.totalStock).toBe(130);
    expect(result.atRiskStock).toBe(30);
    expect(result.usefulStock).toBe(100);
    expect(result.daysToNearestExpiry).toBe(5);
  });

  it('treats already-expired batches as at-risk, not useful', () => {
    const batches = [batch({ availableQty: 20, expirationDate: new Date('2026-08-01') })];
    const result = computeUsefulStock(batches, 30, NOW);
    expect(result.usefulStock).toBe(0);
    expect(result.atRiskStock).toBe(20);
  });

  it('returns zeroed, null-expiry results for an item with no batches', () => {
    const result = computeUsefulStock([], 30, NOW);
    expect(result).toEqual({
      totalStock: 0,
      usefulStock: 0,
      atRiskStock: 0,
      nearestExpiry: null,
      daysToNearestExpiry: null,
    });
  });
});

describe('planFefoDispatch', () => {
  it('draws from the soonest-expiring batch first, spilling into the next as needed', () => {
    const batches = [
      batch({ id: 'later', availableQty: 50, expirationDate: new Date('2027-01-01') }),
      batch({ id: 'sooner', availableQty: 10, expirationDate: new Date('2026-09-01') }),
    ];
    const { allocations, shortfall } = planFefoDispatch(batches, 15);
    expect(allocations).toEqual([
      { batchId: 'sooner', qty: 10 },
      { batchId: 'later', qty: 5 },
    ]);
    expect(shortfall).toBe(0);
  });

  it('reports a shortfall when total availability is insufficient', () => {
    const batches = [batch({ id: 'only', availableQty: 4 })];
    const { allocations, shortfall } = planFefoDispatch(batches, 10);
    expect(allocations).toEqual([{ batchId: 'only', qty: 4 }]);
    expect(shortfall).toBe(6);
  });
});
