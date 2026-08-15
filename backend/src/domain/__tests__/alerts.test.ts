import { describe, expect, it } from 'vitest';
import { evaluateStockAlerts } from '../alerts';

const base = {
  itemId: 'i1',
  itemName: 'Adrenalina 1mg/mL',
  currentStock: 100,
  minimumThreshold: 20,
  daysToNearestExpiry: null as number | null,
  expiryWindowDays: 30,
  dailyConsumptionHistory: [] as number[],
  todayConsumption: 0,
};

describe('evaluateStockAlerts', () => {
  it('raises no alerts for a healthy item', () => {
    expect(evaluateStockAlerts(base)).toEqual([]);
  });

  it('raises CRITICAL_STOCK when stock is at or below the minimum threshold', () => {
    const alerts = evaluateStockAlerts({ ...base, currentStock: 20 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'CRITICAL_STOCK', severity: 'CRITICAL' });
  });

  it('raises a WARNING expiry-risk alert within the risk window, CRITICAL once expired', () => {
    const upcoming = evaluateStockAlerts({ ...base, daysToNearestExpiry: 10 });
    expect(upcoming[0]).toMatchObject({ type: 'EXPIRY_RISK', severity: 'WARNING' });

    const expired = evaluateStockAlerts({ ...base, daysToNearestExpiry: -1 });
    expect(expired[0]).toMatchObject({ type: 'EXPIRY_RISK', severity: 'CRITICAL' });
  });

  it('does not raise expiry risk outside the risk window', () => {
    const alerts = evaluateStockAlerts({ ...base, daysToNearestExpiry: 45 });
    expect(alerts.find((a) => a.type === 'EXPIRY_RISK')).toBeUndefined();
  });

  it('flags anomalous consumption when today spikes beyond mean + 2 sigma', () => {
    const history = [8, 9, 10, 11, 12]; // mean=10, sigma≈1.414 -> threshold≈12.83
    const alerts = evaluateStockAlerts({ ...base, dailyConsumptionHistory: history, todayConsumption: 50 });
    expect(alerts.find((a) => a.type === 'ANOMALOUS_CONSUMPTION')).toBeDefined();
  });

  it('does not flag a constant-consumption history (sigma=0) regardless of today', () => {
    const alerts = evaluateStockAlerts({
      ...base,
      dailyConsumptionHistory: [10, 10, 10, 10, 10],
      todayConsumption: 999,
    });
    expect(alerts.find((a) => a.type === 'ANOMALOUS_CONSUMPTION')).toBeUndefined();
  });

  it('does not flag anomalous consumption with fewer than 5 data points', () => {
    const alerts = evaluateStockAlerts({
      ...base,
      dailyConsumptionHistory: [1, 1, 1],
      todayConsumption: 1000,
    });
    expect(alerts.find((a) => a.type === 'ANOMALOUS_CONSUMPTION')).toBeUndefined();
  });

  it('can raise multiple alerts at once', () => {
    const alerts = evaluateStockAlerts({
      ...base,
      currentStock: 5,
      daysToNearestExpiry: 2,
    });
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.type).sort()).toEqual(['CRITICAL_STOCK', 'EXPIRY_RISK']);
  });
});
