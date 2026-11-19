import type { CityId } from "@/lib/types";

export interface Point {
  x: number;
  y: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Rough city bounds used to project seed grid coords ↔ lat/lng */
export const cityBounds: Record<CityId, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  abuja: { minLat: 8.9, maxLat: 9.2, minLng: 7.3, maxLng: 7.6 },
  lagos: { minLat: 6.4, maxLat: 6.7, minLng: 3.2, maxLng: 3.6 },
};

export const cityCenters: Record<CityId, LatLng> = {
  abuja: { lat: 9.0765, lng: 7.3986 },
  lagos: { lat: 6.5244, lng: 3.3792 },
};

export function toGrid(city: CityId, lat: number, lng: number): Point {
  const b = cityBounds[city];
  const x = ((lng - b.minLng) / (b.maxLng - b.minLng)) * 100;
  const y = (1 - (lat - b.minLat) / (b.maxLat - b.minLat)) * 100;
  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y)),
  };
}

export function fromGrid(city: CityId, x: number, y: number): LatLng {
  const b = cityBounds[city];
  return {
    lng: b.minLng + (x / 100) * (b.maxLng - b.minLng),
    lat: b.minLat + (1 - y / 100) * (b.maxLat - b.minLat),
  };
}

export function ring(cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 7 - 0.5;
    return {
      x: Math.round((cx + Math.cos(a) * rx) * 10) / 10,
      y: Math.round((cy + Math.sin(a) * ry) * 10) / 10,
    };
  });
}

export function ringLatLng(city: CityId, cx: number, cy: number, rx: number, ry: number): LatLng[] {
  return ring(cx, cy, rx, ry).map((point) => fromGrid(city, point.x, point.y));
}

export function inside(point: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses = (pi.y > point.y) !== (pj.y > point.y);
    if (crosses && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 0.0001) + pi.x) hit = !hit;
  }
  return hit;
}

export function pointsAttr(points: Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
