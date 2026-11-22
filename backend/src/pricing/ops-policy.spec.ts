import {
  additionalStopFare,
  classifyDetour,
  mergeFactors,
} from './fare.engine';
import { DEFAULT_FARE_FACTORS, DEFAULT_OPS_POLICY } from './fare.types';

describe('ops policy', () => {
  it('classifies detours by configurable metre thresholds', () => {
    expect(classifyDetour(200)).toBe('minor');
    expect(classifyDetour(500)).toBe('minor');
    expect(classifyDetour(750)).toBe('moderate');
    expect(classifyDetour(1200)).toBe('significant');
  });

  it('prices additional stop distance and time with class multiplier', () => {
    const fare = additionalStopFare(2, 8, DEFAULT_FARE_FACTORS, 'ryde');
    // 2×140 + 8×25 = 280 + 200 = 480
    expect(fare).toBe(480);
  });

  it('merges nested ops without dropping defaults', () => {
    const next = mergeFactors(DEFAULT_FARE_FACTORS, {
      ops: { freeWaitMinutes: 12 },
    });
    expect(next.ops.freeWaitMinutes).toBe(12);
    expect(next.ops.minorDetourMeters).toBe(
      DEFAULT_OPS_POLICY.minorDetourMeters,
    );
    expect(next.ops.waitAppliesToPickup).toBe(true);
  });
});
