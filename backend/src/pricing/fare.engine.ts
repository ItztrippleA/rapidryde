import {
  DEFAULT_FARE_FACTORS,
  DEFAULT_OPS_POLICY,
  type FareBreakdown,
  type FareFactors,
  type OpsPolicy,
  type QuoteInput,
} from './fare.types';

const STEP = 100;

function bandedDistance(km: number, factors: FareFactors) {
  const bands = [...factors.bands].sort(
    (a, b) => (a.upToKm ?? 10_000) - (b.upToKm ?? 10_000),
  );
  let left = Math.max(0, km);
  let cursor = 0;
  let cost = 0;
  for (const band of bands) {
    const room = band.upToKm == null ? left : Math.max(0, band.upToKm - cursor);
    const slice = Math.min(left, room);
    cost += slice * band.perKm;
    left -= slice;
    cursor += slice;
    if (left <= 0) break;
  }
  return cost;
}

function distanceCharge(km: number, factors: FareFactors) {
  if (factors.distanceMode === 'flat') return Math.max(0, km) * factors.perKm;
  return bandedDistance(km, factors);
}

function classMultiplier(factors: FareFactors, classId?: string) {
  const id = classId || 'ryde';
  return factors.classes.find((item) => item.id === id)?.multiplier ?? 1;
}

function snap(value: number) {
  return Math.round(value / STEP) * STEP;
}

type Promo = {
  code: string;
  kind: 'amount' | 'percent';
  value: number;
  cap: number | null;
  minFare: number;
};

const DEFAULT_PROMOS: Promo[] = [
  { code: 'RYDE', kind: 'amount', value: 500, cap: null, minFare: 1500 },
  { code: 'RYDE10', kind: 'percent', value: 10, cap: 2000, minFare: 2000 },
];

function promoOff(
  fare: number,
  code: string | undefined,
  promos: Promo[] = DEFAULT_PROMOS,
) {
  if (!code) return 0;
  const promo = promos.find((item) => item.code === code.trim().toUpperCase());
  if (!promo || fare < promo.minFare) return 0;
  if (promo.kind === 'amount') return Math.min(fare, promo.value);
  const raw = Math.round(fare * (promo.value / 100));
  return Math.min(promo.cap ?? raw, raw);
}

/**
 * Fare = B + (D × Rd) + (T × Rt) + E
 * then × class × surge × conditional multipliers, floor at minimum, minus promo.
 */
export function calculateFare(
  input: QuoteInput,
  factors: FareFactors = DEFAULT_FARE_FACTORS,
): FareBreakdown {
  const km = Math.max(0, Number(input.km) || 0);
  const minutes = Math.max(0, Number(input.minutes) || 0);
  const waitMinutes = Math.max(0, Number(input.waitMinutes) || 0);
  const surge = Math.max(0.1, Number(input.surge) || 1);
  const classId = input.classId || 'ryde';
  const multiplier = classMultiplier(factors, classId);

  const B = factors.baseFare;
  const distance = distanceCharge(km, factors);
  const time = minutes * factors.perMinute;
  const bookingFee = factors.bookingFee;
  const waitFee = waitMinutes * factors.waitPerMinute;
  let surcharge = 0;
  if (input.intercity) surcharge += Math.max(0, km) * factors.intercityPerKm;
  // Conditional multipliers contribute into E as additive uplift on the core parts.
  let conditional = 1;
  if (input.airport) conditional *= factors.airportMultiplier;
  if (input.night) conditional *= factors.nightMultiplier;
  if (input.rain) conditional *= factors.rainMultiplier;
  const core = B + distance + time;
  const conditionalExtra = conditional > 1 ? core * (conditional - 1) : 0;
  const E = bookingFee + waitFee + surcharge + conditionalExtra;

  const raw = (B + distance + time + E) * multiplier * surge;
  const beforePromo = Math.max(factors.minimumFare, snap(raw));
  const discount = promoOff(beforePromo, input.promoCode);
  const fare = Math.max(factors.minimumFare, beforePromo - discount);
  const driverEarnings = Math.max(
    0,
    Math.round(fare * (1 - factors.commissionPercent / 100)),
  );

  return {
    base: Math.round(B),
    distance: Math.round(distance),
    time: Math.round(time),
    extras: Math.round(E),
    bookingFee: Math.round(bookingFee),
    waitFee: Math.round(waitFee),
    surcharge: Math.round(surcharge + conditionalExtra),
    classMultiplier: multiplier,
    surge,
    discount,
    fare,
    driverEarnings,
    formula: 'Fare = B + (D × Rd) + (T × Rt) + E',
    factors: {
      baseFare: factors.baseFare,
      perKm: factors.perKm,
      perMinute: factors.perMinute,
      bookingFee: factors.bookingFee,
      distanceMode: factors.distanceMode,
    },
    km,
    minutes,
    classId,
  };
}

export function mergeOps(
  current: OpsPolicy = DEFAULT_OPS_POLICY,
  patch?: Partial<OpsPolicy>,
): OpsPolicy {
  if (!patch) return { ...DEFAULT_OPS_POLICY, ...current };
  return {
    ...DEFAULT_OPS_POLICY,
    ...current,
    ...patch,
    trafficCompClassIds:
      patch.trafficCompClassIds ??
      current.trafficCompClassIds ??
      DEFAULT_OPS_POLICY.trafficCompClassIds,
    trafficCompCities:
      patch.trafficCompCities ??
      current.trafficCompCities ??
      DEFAULT_OPS_POLICY.trafficCompCities,
  };
}

export type FareFactorsPatch = Partial<Omit<FareFactors, 'ops'>> & {
  ops?: Partial<OpsPolicy>;
};

export function mergeFactors(
  current: FareFactors,
  patch: FareFactorsPatch,
): FareFactors {
  return {
    ...current,
    ...patch,
    bands: patch.bands ?? current.bands,
    classes: patch.classes ?? current.classes,
    distanceMode: patch.distanceMode ?? current.distanceMode,
    ops: mergeOps(current.ops || DEFAULT_OPS_POLICY, patch.ops),
  };
}

/** Extra fare for additional driving distance/time (stop detour). */
export function additionalStopFare(
  additionalKm: number,
  additionalMinutes: number,
  factors: FareFactors,
  classId?: string,
) {
  const multiplier =
    factors.classes.find((item) => item.id === (classId || 'ryde'))
      ?.multiplier ?? 1;
  const distance = Math.max(0, additionalKm) * factors.perKm;
  const time = Math.max(0, additionalMinutes) * factors.perMinute;
  return Math.max(0, Math.round((distance + time) * multiplier));
}

export function classifyDetour(
  additionalMeters: number,
  ops: OpsPolicy = DEFAULT_OPS_POLICY,
): 'none' | 'minor' | 'moderate' | 'significant' {
  const meters = Math.max(0, additionalMeters);
  if (meters <= 0) return 'none';
  if (meters <= ops.minorDetourMeters) return 'minor';
  if (meters <= ops.moderateDetourMeters) return 'moderate';
  return 'significant';
}
