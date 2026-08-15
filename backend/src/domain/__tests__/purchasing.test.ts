import { describe, expect, it } from 'vitest';
import {
  buildRecommendation,
  canTransitionPoStatus,
  computeAverageDailyConsumption,
  computeOrderQuantity,
  computeReorderPoint,
  computeSafetyStock,
  splitDeliveryByCapacity,
  standardDeviation,
} from '../purchasing';

describe('canTransitionPoStatus', () => {
  it('allows the documented happy path', () => {
    expect(canTransitionPoStatus('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransitionPoStatus('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransitionPoStatus('APPROVED', 'RECEIVED')).toBe(true);
  });

  it('allows rejection and cancellation from open states', () => {
    expect(canTransitionPoStatus('SUBMITTED', 'REJECTED')).toBe(true);
    expect(canTransitionPoStatus('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransitionPoStatus('SUBMITTED', 'CANCELLED')).toBe(true);
    expect(canTransitionPoStatus('APPROVED', 'CANCELLED')).toBe(true);
  });

  it('allows a rejected order to be reopened as a draft', () => {
    expect(canTransitionPoStatus('REJECTED', 'DRAFT')).toBe(true);
  });

  it('rejects skipping stages', () => {
    expect(canTransitionPoStatus('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransitionPoStatus('DRAFT', 'RECEIVED')).toBe(false);
    expect(canTransitionPoStatus('SUBMITTED', 'RECEIVED')).toBe(false);
  });

  it('treats RECEIVED and CANCELLED as terminal', () => {
    expect(canTransitionPoStatus('RECEIVED', 'DRAFT')).toBe(false);
    expect(canTransitionPoStatus('RECEIVED', 'CANCELLED')).toBe(false);
    expect(canTransitionPoStatus('CANCELLED', 'DRAFT')).toBe(false);
  });
});

describe('computeAverageDailyConsumption', () => {
  it('averages the history', () => {
    expect(computeAverageDailyConsumption([4, 6, 8, 10])).toBe(7);
  });
  it('is 0 for an empty history', () => {
    expect(computeAverageDailyConsumption([])).toBe(0);
  });
});

describe('standardDeviation', () => {
  it('computes the population standard deviation', () => {
    // mean=5, variance=((-2)^2+(-1)^2+0^2+1^2+2^2)/5=2, sqrt(2)~=1.414
    expect(standardDeviation([3, 4, 5, 6, 7])).toBeCloseTo(1.4142, 3);
  });
  it('is 0 for a constant series and for an empty one', () => {
    expect(standardDeviation([5, 5, 5])).toBe(0);
    expect(standardDeviation([])).toBe(0);
  });
});

describe('computeSafetyStock', () => {
  it('scales up for VEN=Vital relative to VEN=No esencial, same demand/lead time', () => {
    const vital = computeSafetyStock({ demandStdDev: 2, leadTimeDays: 9, ven: 'V' });
    const nonEssential = computeSafetyStock({ demandStdDev: 2, leadTimeDays: 9, ven: 'N' });
    expect(vital).toBeGreaterThan(nonEssential);
  });

  it('matches the documented formula SS = Z * sigma * sqrt(TE) * venWeight', () => {
    // Z default 1.65, sigma=2, TE=9 -> sqrt=3, ven=N -> multiplier 1.0
    const ss = computeSafetyStock({ demandStdDev: 2, leadTimeDays: 9, ven: 'N' });
    expect(ss).toBe(Math.ceil(1.65 * 2 * 3 * 1));
  });
});

describe('computeReorderPoint', () => {
  it('is CDP * leadTime + safetyStock, rounded up', () => {
    expect(computeReorderPoint(6, 10, 12)).toBe(72);
    expect(computeReorderPoint(6.5, 10, 12)).toBe(77); // ceil(65+12)
  });
});

describe('computeOrderQuantity', () => {
  it('returns 0 when current stock already covers the review horizon', () => {
    const qty = computeOrderQuantity({
      averageDailyConsumption: 1,
      moq: 1,
      maxStorageCapacity: 0,
      currentUsefulStock: 1000,
      reorderPoint: 20,
    });
    expect(qty).toBe(0);
  });

  it('rounds the shortfall up to the nearest MOQ multiple', () => {
    const qty = computeOrderQuantity({
      averageDailyConsumption: 2,
      moq: 25,
      maxStorageCapacity: 0,
      currentUsefulStock: 0,
      reorderPoint: 10,
      reviewHorizonDays: 30,
    });
    // targetLevel = 10 + 2*30 = 70; ceil(70/25)*25 = 75
    expect(qty).toBe(75);
  });

  it('caps the quantity at available storage headroom', () => {
    const qty = computeOrderQuantity({
      averageDailyConsumption: 5,
      moq: 1,
      maxStorageCapacity: 100,
      currentUsefulStock: 90,
      reorderPoint: 20,
      reviewHorizonDays: 30,
    });
    // targetLevel = 20 + 150 = 170; uncapped need = 80; headroom = 100-90=10
    expect(qty).toBe(10);
  });
});

describe('splitDeliveryByCapacity', () => {
  it('does not split when the quantity fits in available capacity', () => {
    expect(splitDeliveryByCapacity(50, 100)).toEqual({ mainDelivery: 50, scheduledDeliveries: [] });
  });

  it('splits the excess into capacity-sized chunks (cold chain constraint)', () => {
    expect(splitDeliveryByCapacity(250, 100)).toEqual({
      mainDelivery: 100,
      scheduledDeliveries: [100, 50],
    });
  });

  it('does not split when there is no capacity constraint (capacity <= 0)', () => {
    expect(splitDeliveryByCapacity(250, 0)).toEqual({ mainDelivery: 250, scheduledDeliveries: [] });
  });
});

describe('buildRecommendation', () => {
  it('does not trigger when useful stock is comfortably above the reorder point', () => {
    const rec = buildRecommendation({
      itemId: 'i1',
      itemName: 'Paracetamol',
      ven: 'N',
      usefulStock: 10000,
      dailyConsumptionHistory: [5, 5, 5, 5, 5],
      leadTimeDays: 7,
      moq: 1,
      maxStorageCapacity: 0,
      availableStorageCapacity: 1000,
      refrigerated: false,
    });
    expect(rec.triggered).toBe(false);
    expect(rec.recommendedQty).toBe(0);
    expect(rec.delivery).toEqual({ mainDelivery: 0, scheduledDeliveries: [] });
  });

  it('triggers and splits the delivery for a refrigerated item that exceeds available capacity', () => {
    const rec = buildRecommendation({
      itemId: 'i2',
      itemName: 'Insulina NPH',
      ven: 'V',
      usefulStock: 5,
      dailyConsumptionHistory: [10, 12, 8, 10, 10],
      leadTimeDays: 10,
      moq: 1,
      maxStorageCapacity: 500,
      availableStorageCapacity: 50, // small fridge headroom
      refrigerated: true,
    });
    expect(rec.triggered).toBe(true);
    expect(rec.recommendedQty).toBeGreaterThan(0);
    expect(rec.delivery.mainDelivery).toBeLessThanOrEqual(50);
    if (rec.recommendedQty > 50) {
      expect(rec.delivery.scheduledDeliveries.length).toBeGreaterThan(0);
      const total =
        rec.delivery.mainDelivery + rec.delivery.scheduledDeliveries.reduce((a, b) => a + b, 0);
      expect(total).toBe(rec.recommendedQty);
    }
  });
});
