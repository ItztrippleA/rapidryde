export type LatLng = { latitude: number; longitude: number };

export function kmBetween(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Degrees from north, clockwise. */
export function bearing(from: LatLng, to: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const φ1 = toRad(from.latitude);
  const φ2 = toRad(to.latitude);
  const Δλ = toRad(to.longitude - from.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function headingDelta(a: number, b: number) {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/**
 * Uber-style destination filter: keep rides ending near the driver's destination
 * or progressing that way — drop rides heading the opposite direction.
 */
export function alongDestination(
  pickup: LatLng,
  dropoff: LatLng,
  destination: LatLng,
  opts?: { nearKm?: number; maxAngle?: number },
) {
  const nearKm = opts?.nearKm ?? 8;
  const maxAngle = opts?.maxAngle ?? 90;
  const dropToDest = kmBetween(dropoff, destination);
  if (dropToDest <= nearKm) return true;

  const pickupToDest = kmBetween(pickup, destination);
  const progresses = dropToDest <= pickupToDest + 1.5;
  if (!progresses) return false;

  const rideBearing = bearing(pickup, dropoff);
  const destBearing = bearing(pickup, destination);
  return headingDelta(rideBearing, destBearing) <= maxAngle;
}
