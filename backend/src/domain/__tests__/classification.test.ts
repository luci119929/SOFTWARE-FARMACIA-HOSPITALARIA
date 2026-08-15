import { describe, expect, it } from 'vitest';
import { computePriority } from '../classification';

describe('computePriority', () => {
  it('gives the maximum score to a Class A, Vital item that already expired', () => {
    const result = computePriority({ abc: 'A', ven: 'V', daysToNearestExpiry: 0 });
    expect(result.score).toBe(100);
    expect(result.band).toBe('CRITICAL');
  });

  it('gives the minimum score to a Class C, non-essential item with no batches', () => {
    const result = computePriority({ abc: 'C', ven: 'N', daysToNearestExpiry: null });
    expect(result.score).toBe(7); // (1*1/9)*60 rounded
    expect(result.band).toBe('LOW');
  });

  it('ignores expiry urgency once past the 90-day horizon', () => {
    const far = computePriority({ abc: 'A', ven: 'V', daysToNearestExpiry: 90 });
    const none = computePriority({ abc: 'A', ven: 'V', daysToNearestExpiry: null });
    expect(far.score).toBe(none.score);
  });

  it('increases score as expiry approaches, for the same ABC/VEN', () => {
    const far = computePriority({ abc: 'B', ven: 'E', daysToNearestExpiry: 60 });
    const near = computePriority({ abc: 'B', ven: 'E', daysToNearestExpiry: 5 });
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('bands scores at the documented thresholds', () => {
    // score = round((abc*ven/9)*60 + urgency*40); band cuts at 30/55/80.
    expect(computePriority({ abc: 'C', ven: 'N', daysToNearestExpiry: null }).band).toBe('LOW'); // score 7
    expect(computePriority({ abc: 'A', ven: 'E', daysToNearestExpiry: null }).band).toBe('MEDIUM'); // score 40
    expect(computePriority({ abc: 'A', ven: 'V', daysToNearestExpiry: null }).band).toBe('HIGH'); // score 60
    expect(computePriority({ abc: 'A', ven: 'V', daysToNearestExpiry: 10 }).band).toBe('CRITICAL'); // score 96
  });
});
