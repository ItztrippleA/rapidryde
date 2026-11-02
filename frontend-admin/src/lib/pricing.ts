import type { Pricing } from "./types";

export function quoteFare(pricing: Pricing, km: number, minutes: number, classMultiplier: number, surge: number) {
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
  const raw = (pricing.baseFare + distanceCost + minutes * pricing.perMinute + pricing.bookingFee) * classMultiplier * surge;
  return Math.max(pricing.minimumFare, Math.round(raw));
}
