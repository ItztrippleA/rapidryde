import type { Pricing } from "./types";

const STEP = 100;

function bandedDistance(pricing: Pricing, km: number) {
  const bands = [...pricing.bands].sort((a, b) => (a.upToKm ?? 10_000) - (b.upToKm ?? 10_000));
  let remaining = Math.max(0, km);
  let cursor = 0;
  let distanceCost = 0;
  for (const band of bands) {
    const cap = band.upToKm ?? Number.POSITIVE_INFINITY;
    const slice = Math.max(0, Math.min(remaining, cap - cursor));
    distanceCost += slice * band.perKm;
    remaining -= slice;
    cursor = cap;
    if (remaining <= 0) break;
  }
  return distanceCost;
}

/**
 * Fare = B + (D × Rd) + (T × Rt) + E
 * then × class × surge, floor at minimum.
 */
export function quoteFare(pricing: Pricing, km: number, minutes: number, classMultiplier: number, surge: number) {
  const B = pricing.baseFare;
  const distance = pricing.distanceMode === "flat" ? Math.max(0, km) * (pricing.perKm ?? 140) : bandedDistance(pricing, km);
  const time = minutes * pricing.perMinute;
  const E = pricing.bookingFee;
  const raw = (B + distance + time + E) * classMultiplier * surge;
  return Math.max(pricing.minimumFare, Math.round(raw / STEP) * STEP);
}

export function fareParts(pricing: Pricing, km: number, minutes: number) {
  const B = pricing.baseFare;
  const distance = pricing.distanceMode === "flat" ? Math.max(0, km) * (pricing.perKm ?? 140) : bandedDistance(pricing, km);
  const time = minutes * pricing.perMinute;
  const E = pricing.bookingFee;
  return { B, distance, time, E, formula: "Fare = B + (D × Rd) + (T × Rt) + E" };
}
