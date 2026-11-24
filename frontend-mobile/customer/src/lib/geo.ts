export type Pin = { latitude: number; longitude: number };

export function kmBetween(a: Pin, b: Pin) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function pathKm(points: Pin[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += kmBetween(points[i - 1], points[i]);
  return total;
}

export function lerpPin(from: Pin, to: Pin, t: number): Pin {
  const amount = Math.min(1, Math.max(0, t));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * amount,
    longitude: from.longitude + (to.longitude - from.longitude) * amount,
  };
}
