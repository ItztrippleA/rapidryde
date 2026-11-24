import { apiBase, hasApi, placesKey } from "./api";
import { kmBetween, type Pin } from "./geo";

export type RouteEstimate = {
  km: number;
  minutes: number;
  staticMinutes: number;
  trafficMinutes: number;
  trafficDelaySec: number;
  delayPercentage: number;
  isTrafficHeavy: boolean;
  source: "google" | "estimate";
  routingPreference?: string;
  computedAt: number;
  polyline?: string;
};

/** Decode a Google encoded polyline into lat/lng points. */
export function decodePolyline(encoded: string): Pin[] {
  if (!encoded) return [];
  const points: Pin[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function haversineEstimate(from: Pin, to: Pin, stops: Pin[] = []): RouteEstimate {
  const points = [from, ...stops, to];
  let km = 0;
  for (let i = 1; i < points.length; i += 1) km += kmBetween(points[i - 1], points[i]);
  const roadKm = Math.max(0.3, Number((km * 1.25).toFixed(1)));
  const minutes = Math.max(2, Math.round((roadKm / 25) * 60));
  return {
    km: roadKm,
    minutes,
    staticMinutes: minutes,
    trafficMinutes: minutes,
    trafficDelaySec: 0,
    delayPercentage: 0,
    isTrafficHeavy: false,
    source: "estimate",
    computedAt: Date.now(),
  };
}

function parseDurationSec(value?: string) {
  if (!value) return 0;
  const match = /^([\d.]+)s$/i.exec(value.trim());
  return match ? Number(match[1]) : 0;
}

function pack(km: number, staticSec: number, trafficSec: number, source: "google" | "estimate"): RouteEstimate {
  const base = Math.max(1, staticSec);
  const traffic = Math.max(base, trafficSec);
  const trafficDelaySec = Math.max(0, Math.round(traffic - base));
  const delayPercentage = Number(((trafficDelaySec / base) * 100).toFixed(1));
  return {
    km,
    minutes: Math.max(1, Math.round(traffic / 60)),
    staticMinutes: Math.max(1, Math.round(base / 60)),
    trafficMinutes: Math.max(1, Math.round(traffic / 60)),
    trafficDelaySec,
    delayPercentage,
    isTrafficHeavy: delayPercentage >= 30 && trafficDelaySec >= 5 * 60,
    source,
    computedAt: Date.now(),
  };
}

/** Prefer backend `/routes/estimate`; fall back to Routes API or haversine. Poll every 60–90s, not every GPS tick. */
export async function estimateRoute(
  from: Pin,
  to: Pin,
  stops: Pin[] = [],
  preference: "TRAFFIC_UNAWARE" | "TRAFFIC_AWARE" | "TRAFFIC_AWARE_OPTIMAL" = "TRAFFIC_AWARE",
): Promise<RouteEstimate> {
  const fallback = haversineEstimate(from, to, stops);

  if (hasApi()) {
    try {
      const via = stops.map((stop) => `${stop.latitude},${stop.longitude}`).join("|");
      const params = new URLSearchParams({
        fromLat: String(from.latitude),
        fromLng: String(from.longitude),
        toLat: String(to.latitude),
        toLng: String(to.longitude),
        preference,
      });
      if (via) params.set("via", via);
      const response = await fetch(`${apiBase}/routes/estimate?${params.toString()}`);
      if (response.ok) {
        const body = (await response.json()) as RouteEstimate;
        if (body?.km > 0 && body?.minutes > 0) return { ...body, computedAt: body.computedAt || Date.now() };
      }
    } catch {
      /* try client Routes API */
    }
  }

  if (placesKey) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: from.latitude, longitude: from.longitude } } },
          destination: { location: { latLng: { latitude: to.latitude, longitude: to.longitude } } },
          intermediates: stops.map((stop) => ({
            location: { latLng: { latitude: stop.latitude, longitude: stop.longitude } },
          })),
          travelMode: "DRIVE",
          routingPreference: preference,
          languageCode: "en-NG",
          regionCode: "NG",
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          routes?: {
            duration?: string;
            staticDuration?: string;
            distanceMeters?: number;
            polyline?: { encodedPolyline?: string };
          }[];
        };
        const route = payload.routes?.[0];
        if (route?.distanceMeters) {
          const trafficSec = parseDurationSec(route.duration);
          const staticSec = parseDurationSec(route.staticDuration) || trafficSec;
          return {
            ...pack(Math.max(0.1, Number((route.distanceMeters / 1000).toFixed(1))), staticSec, trafficSec, "google"),
            polyline: route.polyline?.encodedPolyline,
          };
        }
      }
    } catch {
      /* haversine */
    }
  }

  return fallback;
}

/** Driving path coordinates for map polylines (not a straight line). */
export async function fetchRoutePath(from: Pin, to: Pin, stops: Pin[] = []): Promise<Pin[]> {
  const estimate = await estimateRoute(from, to, stops);
  if (estimate.polyline) {
    const decoded = decodePolyline(estimate.polyline);
    if (decoded.length >= 2) return decoded;
  }
  return [from, ...stops, to];
}

export function etaLabel(estimate: RouteEstimate | null | undefined) {
  if (!estimate) return "";
  if (estimate.isTrafficHeavy) {
    const delayMin = Math.max(1, Math.round(estimate.trafficDelaySec / 60));
    return `${estimate.minutes} min · +${delayMin} min traffic`;
  }
  return `${estimate.minutes} min`;
}
