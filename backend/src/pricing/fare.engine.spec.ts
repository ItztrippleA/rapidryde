import { calculateFare } from './fare.engine';
import { DEFAULT_FARE_FACTORS } from './fare.types';

describe('calculateFare', () => {
  it('uses Fare = B + (D × Rd) + (T × Rt) + E in flat mode', () => {
    const factors = {
      ...DEFAULT_FARE_FACTORS,
      distanceMode: 'flat' as const,
      baseFare: 400,
      perKm: 100,
      perMinute: 20,
      bookingFee: 100,
      waitPerMinute: 0,
      minimumFare: 0,
      airportMultiplier: 1,
      nightMultiplier: 1,
      rainMultiplier: 1,
      commissionPercent: 10,
      classes: [{ id: 'ryde', label: 'Ryde', multiplier: 1 }],
    };
    const quote = calculateFare(
      { km: 10, minutes: 15, classId: 'ryde' },
      factors,
    );
    // B=400, D*Rd=1000, T*Rt=300, E=100 → 1800
    expect(quote.base).toBe(400);
    expect(quote.distance).toBe(1000);
    expect(quote.time).toBe(300);
    expect(quote.bookingFee).toBe(100);
    expect(quote.fare).toBe(1800);
    expect(quote.driverEarnings).toBe(1620);
    expect(quote.formula).toContain('B + (D × Rd)');
  });

  it('respects minimum fare', () => {
    const quote = calculateFare(
      { km: 0.2, minutes: 1, classId: 'ryde' },
      DEFAULT_FARE_FACTORS,
    );
    expect(quote.fare).toBeGreaterThanOrEqual(DEFAULT_FARE_FACTORS.minimumFare);
  });
});
