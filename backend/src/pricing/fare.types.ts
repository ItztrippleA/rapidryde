/** Admin-editable fare factors. Fare = B + (D × Rd) + (T × Rt) + E */

export type DistanceMode = 'flat' | 'banded';

export type DistanceBand = {
  id: string;
  label: string;
  upToKm: number | null;
  perKm: number;
};

export type ClassRate = {
  id: string;
  label: string;
  multiplier: number;
};

/** Admin-editable route / waiting / traffic compensation policy. */
export type OpsPolicy = {
  /** Max intermediate stops on a trip (booking + mid-trip). */
  maxStops: number;
  /** Detour thresholds vs original driving route (metres). */
  minorDetourMeters: number;
  moderateDetourMeters: number;
  /** Free waiting minutes before charges. */
  freeWaitMinutes: number;
  /** Send warning this many minutes after arrival. */
  waitWarningMinutes: number;
  /** Extra minutes after free wait before billing starts. */
  waitGraceMinutes: number;
  waitAppliesToPickup: boolean;
  waitAppliesToStops: boolean;
  /** Driver must be within this distance to start waiting. */
  arrivalGeofenceMeters: number;
  /** Unexpected traffic compensation (driver ledger, not auto passenger debit). */
  trafficCompMinDelayMinutes: number;
  trafficCompPerMinute: number;
  trafficCompMaxPerTrip: number;
  /** Empty = all classes / cities. */
  trafficCompClassIds: string[];
  trafficCompCities: string[];
  /** Never auto-bill riders for traffic unless explicitly enabled. */
  chargePassengerForTraffic: boolean;
};

export type FareFactors = {
  /** B — base fare in naira */
  baseFare: number;
  /** Rd — flat price per kilometre when distanceMode is flat */
  perKm: number;
  /** Rt — price per minute */
  perMinute: number;
  /** Floor after all parts */
  minimumFare: number;
  /** Part of E — booking fee */
  bookingFee: number;
  cancellationFee: number;
  /** Part of E — wait charge per minute */
  waitPerMinute: number;
  /** Driver commission percent (earnings take) */
  commissionPercent: number;
  airportMultiplier: number;
  nightMultiplier: number;
  rainMultiplier: number;
  intercityPerKm: number;
  /** flat uses perKm; banded uses bands[] for D × Rd */
  distanceMode: DistanceMode;
  bands: DistanceBand[];
  classes: ClassRate[];
  ops: OpsPolicy;
};

export type QuoteInput = {
  km: number;
  minutes: number;
  classId?: string;
  waitMinutes?: number;
  surge?: number;
  airport?: boolean;
  night?: boolean;
  rain?: boolean;
  intercity?: boolean;
  promoCode?: string;
};

export type FareBreakdown = {
  /** B */
  base: number;
  /** D × Rd (or banded equivalent) */
  distance: number;
  /** T × Rt */
  time: number;
  /** E — booking + wait + extras before multipliers */
  extras: number;
  bookingFee: number;
  waitFee: number;
  surcharge: number;
  classMultiplier: number;
  surge: number;
  discount: number;
  /** Final fare after min + promo */
  fare: number;
  driverEarnings: number;
  formula: string;
  factors: Pick<
    FareFactors,
    'baseFare' | 'perKm' | 'perMinute' | 'bookingFee' | 'distanceMode'
  >;
  km: number;
  minutes: number;
  classId: string;
};

export const DEFAULT_OPS_POLICY: OpsPolicy = {
  maxStops: 2,
  minorDetourMeters: 500,
  moderateDetourMeters: 1000,
  freeWaitMinutes: 10,
  waitWarningMinutes: 8,
  waitGraceMinutes: 0,
  waitAppliesToPickup: true,
  waitAppliesToStops: true,
  arrivalGeofenceMeters: 120,
  trafficCompMinDelayMinutes: 10,
  trafficCompPerMinute: 20,
  trafficCompMaxPerTrip: 2000,
  trafficCompClassIds: [],
  trafficCompCities: [],
  chargePassengerForTraffic: false,
};

export const DEFAULT_FARE_FACTORS: FareFactors = {
  baseFare: 400,
  perKm: 140,
  perMinute: 25,
  minimumFare: 700,
  bookingFee: 100,
  cancellationFee: 300,
  waitPerMinute: 40,
  commissionPercent: 10,
  airportMultiplier: 1.35,
  nightMultiplier: 1.15,
  rainMultiplier: 1.2,
  intercityPerKm: 180,
  distanceMode: 'banded',
  bands: [
    { id: 'b1', label: 'First 3 km', upToKm: 3, perKm: 180 },
    { id: 'b2', label: '3 to 10 km', upToKm: 10, perKm: 140 },
    { id: 'b3', label: 'Beyond 10 km', upToKm: null, perKm: 110 },
  ],
  classes: [
    { id: 'ryde', label: 'Ryde', multiplier: 1 },
    { id: 'along', label: 'Along', multiplier: 1 },
    { id: 'comfort', label: 'Comfort', multiplier: 1.35 },
    { id: 'xl', label: 'XL', multiplier: 1.55 },
    { id: 'executive', label: 'Executive', multiplier: 2.05 },
    { id: 'green', label: 'Green', multiplier: 1.12 },
    { id: 'keke', label: 'Keke', multiplier: 0.55 },
  ],
  ops: DEFAULT_OPS_POLICY,
};
