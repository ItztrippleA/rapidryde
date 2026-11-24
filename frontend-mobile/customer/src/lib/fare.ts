import { kmBetween, pathKm, type Pin } from "./geo";
import { apiBase, hasApi } from "./api";

/**
 * Fare = B + (D × Rd) + (T × Rt) + E
 * Factors start local and are replaced when GET /pricing succeeds.
 */
export let pricing = {
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
  distanceMode: "banded" as "flat" | "banded",
  bands: [
    { upToKm: 3 as number | null, perKm: 180 },
    { upToKm: 10 as number | null, perKm: 140 },
    { upToKm: null as number | null, perKm: 110 },
  ],
  classes: [
    { id: "ryde", label: "Ryde", multiplier: 1 },
    { id: "along", label: "Along", multiplier: 1 },
    { id: "comfort", label: "Comfort", multiplier: 1.35 },
    { id: "xl", label: "XL", multiplier: 1.55 },
    { id: "executive", label: "Executive", multiplier: 2.05 },
    { id: "green", label: "Green", multiplier: 1.12 },
    { id: "keke", label: "Keke", multiplier: 0.55 },
  ],
};

/** Seats on an Along car (passenger seats). */
export const ALONG_SEATS = 3;
export const ALONG_MATCH_KM = 4;

export const MAX_STOPS = 2;
/** Standard matching radius around pickup — outside this, show “no ride nearby” until the rider extends. */
export const SEARCH_RADIUS_KM = 6;
/** Wider radius when the rider opts into extended search (drivers set their own pickup price). */
export const EXTENDED_SEARCH_RADIUS_KM = 25;
/** Optional bump when nearby drivers are slow to accept — fraction of the original quote. */
export const FARE_TOPUP_RATIO = 0.2;
/** Schedule at most through end of tomorrow (today + 1 day). */
export const SCHEDULE_AHEAD_DAYS = 1;
/** @deprecated Prefer SCHEDULE_AHEAD_DAYS — kept for copy that still mentions hours. */
export const SCHEDULE_AHEAD_HOURS = 48;
export const RAISE = 0.4;
export const LOWER = 0.2;
export const STEP = 100;
export const SAMPLE_RYDE_QUOTE = 6000;

export type ClassId = (typeof pricing.classes)[number]["id"];

export type FareParts = {
  base: number;
  distance: number;
  time: number;
  booking: number;
  surcharge: number;
  discount: number;
  quote: number;
  minutes: number;
  km: number;
  sampleRoute: boolean;
  formula: string;
};

const promos = [
  { code: "RYDE", kind: "amount" as const, value: 500, cap: null as number | null, minFare: 1500 },
  { code: "RYDE10", kind: "percent" as const, value: 10, cap: 2000, minFare: 2000 },
];

export function classById(id: string) {
  return pricing.classes.find((item) => item.id === id) ?? pricing.classes[0];
}

function bandedDistance(km: number) {
  let left = Math.max(0, km);
  let cost = 0;
  let cursor = 0;
  for (const band of pricing.bands) {
    const room = band.upToKm == null ? left : Math.max(0, band.upToKm - cursor);
    const slice = Math.min(left, room);
    cost += slice * band.perKm;
    left -= slice;
    cursor += slice;
    if (left <= 0) break;
  }
  return cost;
}

function distanceCharge(km: number) {
  if (pricing.distanceMode === "flat") return Math.max(0, km) * pricing.perKm;
  return bandedDistance(km);
}

export function isSampleRoute(pickup: string, dropoff: string) {
  const from = pickup.toLowerCase();
  const to = dropoff.toLowerCase();
  return from.includes("wuse market") && to.includes("jabi lake");
}

export function alongSeatFare(routeQuote: number, riderKm: number[], yourKm: number) {
  const weights = [...riderKm.map((km) => Math.max(0.3, km)), Math.max(0.3, yourKm)];
  const total = weights.reduce((sum, km) => sum + km, 0) || 1;
  const share = weights[weights.length - 1] / total;
  const raw = Math.round((routeQuote * share) / STEP) * STEP;
  return Math.max(pricing.minimumFare, raw);
}

/** Fare = B + (D × Rd) + (T × Rt) + E. Pass traffic-aware `minutes` when known. */
export function estimateFare(
  km: number,
  classId: string,
  promoCode: string,
  sampleRoute: boolean,
  minutesOverride?: number,
): FareParts {
  const ride = classById(classId);
  const minutes = Math.max(5, minutesOverride ?? Math.round((km / 25) * 60));
  const formula = "Fare = B + (D × Rd) + (T × Rt) + E";
  if (ride.id === "along") {
    const solo = estimateFare(km, "ryde", promoCode, sampleRoute, minutesOverride);
    const alone = alongSeatFare(solo.quote, [], km);
    return { ...solo, quote: alone, sampleRoute: solo.sampleRoute, formula };
  }
  if (sampleRoute && ride.id === "ryde") {
    const discount = promoOff(SAMPLE_RYDE_QUOTE, promoCode);
    return {
      base: pricing.baseFare,
      distance: 0,
      time: 0,
      booking: pricing.bookingFee,
      surcharge: 0,
      discount,
      quote: Math.max(pricing.minimumFare, SAMPLE_RYDE_QUOTE - discount),
      minutes,
      km,
      sampleRoute: true,
      formula,
    };
  }
  if (sampleRoute) {
    const scaled = Math.round((SAMPLE_RYDE_QUOTE * ride.multiplier) / STEP) * STEP;
    const discount = promoOff(scaled, promoCode);
    return {
      base: pricing.baseFare,
      distance: 0,
      time: 0,
      booking: pricing.bookingFee,
      surcharge: 0,
      discount,
      quote: Math.max(pricing.minimumFare, scaled - discount),
      minutes,
      km,
      sampleRoute: true,
      formula,
    };
  }

  const B = pricing.baseFare;
  const distance = Math.round(distanceCharge(km) * ride.multiplier);
  const time = Math.round(minutes * pricing.perMinute * ride.multiplier);
  const booking = pricing.bookingFee;
  const before = Math.max(pricing.minimumFare, Math.round((B + distance + time + booking) / STEP) * STEP);
  const discount = promoOff(before, promoCode);
  return {
    base: B,
    distance,
    time,
    booking,
    surcharge: 0,
    discount,
    quote: Math.max(pricing.minimumFare, before - discount),
    minutes,
    km,
    sampleRoute: false,
    formula,
  };
}

function promoOff(fare: number, code: string) {
  const promo = promos.find((item) => item.code === code.trim().toUpperCase());
  if (!promo || fare < promo.minFare) return 0;
  if (promo.kind === "amount") return Math.min(fare, promo.value);
  const raw = Math.round(fare * (promo.value / 100));
  return Math.min(promo.cap ?? raw, raw);
}

export function fareBounds(quoted: number) {
  const min = Math.max(STEP, Math.round((quoted * (1 - LOWER)) / STEP) * STEP);
  const max = Math.max(min, Math.round((quoted * (1 + RAISE)) / STEP) * STEP);
  return { min, max };
}

export function clampFare(quoted: number, fare: number) {
  const { min, max } = fareBounds(quoted);
  const snapped = Math.round(fare / STEP) * STEP;
  return Math.min(max, Math.max(min, snapped));
}

export function routeKm(pickup: Pin, dropoff: Pin, stops: Pin[]) {
  return pathKm([pickup, ...stops, dropoff]);
}

export function minutesBetween(a: Pin, b: Pin) {
  return Math.max(1, Math.round((kmBetween(a, b) / 25) * 60));
}

/** Pull admin-edited factors from NestJS when EXPO_PUBLIC_API_URL is set. */
export async function hydratePricingFromApi() {
  if (!hasApi()) return false;
  try {
    const response = await fetch(`${apiBase}/pricing`);
    if (!response.ok) return false;
    const remote = (await response.json()) as Partial<typeof pricing>;
    pricing = {
      ...pricing,
      ...remote,
      bands: Array.isArray(remote.bands) ? remote.bands.map((band) => ({ upToKm: band.upToKm ?? null, perKm: band.perKm })) : pricing.bands,
      classes: Array.isArray(remote.classes) && remote.classes.length ? (remote.classes as typeof pricing.classes) : pricing.classes,
      distanceMode: remote.distanceMode === "flat" ? "flat" : "banded",
    };
    return true;
  } catch {
    return false;
  }
}

/** Prefer server quote when API is live. */
export async function quoteFromApi(km: number, minutes: number, classId: string, promoCode?: string) {
  if (!hasApi()) return null;
  try {
    const response = await fetch(`${apiBase}/pricing/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ km, minutes, classId, promoCode }),
    });
    if (!response.ok) return null;
    return (await response.json()) as {
      fare: number;
      base: number;
      distance: number;
      time: number;
      bookingFee: number;
      discount: number;
      formula: string;
    };
  } catch {
    return null;
  }
}
