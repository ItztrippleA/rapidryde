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
 * Distance from point P to segment A→B (approx local km plane).
 * `t` is 0 at A, 1 at B (may be outside [0,1] if projected beyond ends).
 */
export function distanceToSegmentKm(
  point: LatLng,
  from: LatLng,
  to: LatLng,
): { distanceKm: number; t: number } {
  const midLat = ((from.latitude + to.latitude) / 2) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(midLat);
  const ky = 110.574;
  const ax = from.longitude * kx;
  const ay = from.latitude * ky;
  const bx = to.longitude * kx;
  const by = to.latitude * ky;
  const px = point.longitude * kx;
  const py = point.latitude * ky;
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-9) {
    return { distanceKm: kmBetween(point, from), t: 0 };
  }
  const t = ((px - ax) * abx + (py - ay) * aby) / ab2;
  const cx = ax + Math.max(0, Math.min(1, t)) * abx;
  const cy = ay + Math.max(0, Math.min(1, t)) * aby;
  const dx = px - cx;
  const dy = py - cy;
  return { distanceKm: Math.sqrt(dx * dx + dy * dy), t };
}

/**
 * Driver going origin (C) → destination (A).
 * Keep a ride only if the rider's dropoff is near A, or sits on/near the C→A path.
 * Rides ending at D/E off that corridor are rejected.
 */
export function alongDestination(
  origin: LatLng,
  riderDropoff: LatLng,
  destination: LatLng,
  opts?: { nearKm?: number; corridorKm?: number },
) {
  const nearKm = Math.max(2, Number(opts?.nearKm ?? 8));
  const corridorKm = Math.max(
    2.5,
    Number(opts?.corridorKm ?? Math.min(6, nearKm * 0.75)),
  );

  // Rider ends around the driver's destination A.
  if (kmBetween(riderDropoff, destination) <= nearKm) return true;

  const pathKm = kmBetween(origin, destination);
  // No useful corridor — only near-destination matches.
  if (pathKm < 0.4) return false;

  const { distanceKm, t } = distanceToSegmentKm(
    riderDropoff,
    origin,
    destination,
  );
  // Must lie along C→A (not behind driver, not far past A).
  if (t < -0.02 || t > 1.12) return false;
  if (distanceKm > corridorKm) return false;

  // Still heading toward A overall — drop should not be farther from A than origin by much.
  const dropToDest = kmBetween(riderDropoff, destination);
  const originToDest = pathKm;
  if (dropToDest > originToDest + 1) return false;

  return true;
}
