import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { kmBetween, type LatLng } from '../lib/geo';

export type RoutingPreference =
  | 'TRAFFIC_UNAWARE'
  | 'TRAFFIC_AWARE'
  | 'TRAFFIC_AWARE_OPTIMAL';

export type RouteEstimate = {
  km: number;
  /** Traffic-aware minutes when Google Routes succeeds; else road estimate. */
  minutes: number;
  /** Duration without live traffic (minutes). */
  staticMinutes: number;
  /** Traffic-aware duration (minutes). Same as minutes when traffic requested. */
  trafficMinutes: number;
  /** Extra seconds implied by live traffic vs static. */
  trafficDelaySec: number;
  /** Percent delay vs static duration. */
  delayPercentage: number;
  /** True when delay ≥ 5 min and ≥ 30% over static. */
  isTrafficHeavy: boolean;
  source: 'google' | 'estimate';
  routingPreference: RoutingPreference;
  computedAt: number;
  /** Encoded Google polyline for the driving path (when available). */
  polyline?: string;
};

@Injectable()
export class RoutingService {
  private readonly log = new Logger(RoutingService.name);
  /** After repeated 403s, skip Google for a while and use haversine (avoids log spam). */
  private googleDisabledUntil = 0;
  private lastGoogleWarnAt = 0;

  constructor(private readonly config: ConfigService) {}

  private key() {
    return (
      this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim() ||
      ''
    );
  }

  /** Straight-line fallback when Routes API is unavailable. */
  estimateHaversine(
    from: LatLng,
    to: LatLng,
    waypoints: LatLng[] = [],
  ): RouteEstimate {
    const points = [from, ...waypoints, to];
    let km = 0;
    for (let i = 1; i < points.length; i += 1) {
      km += kmBetween(points[i - 1], points[i]);
    }
    const roadKm = Math.max(0.3, Number((km * 1.25).toFixed(1)));
    const minutes = Math.max(2, Math.round((roadKm / 25) * 60));
    return packEstimate({
      km: roadKm,
      staticSec: minutes * 60,
      trafficSec: minutes * 60,
      source: 'estimate',
      routingPreference: 'TRAFFIC_UNAWARE',
    });
  }

  /**
   * Google Routes API (v2) with TRAFFIC_AWARE by default.
   * Compare staticDuration (no traffic) vs duration (traffic-aware) for delays.
   */
  async route(
    from: LatLng,
    to: LatLng,
    waypoints: LatLng[] = [],
    preference: RoutingPreference = 'TRAFFIC_AWARE',
  ): Promise<RouteEstimate> {
    const fallback = this.estimateHaversine(from, to, waypoints);
    const key = this.key();
    if (!key) return fallback;
    if (Date.now() < this.googleDisabledUntil) return fallback;
    if (
      ![from, to, ...waypoints].every(
        (point) =>
          Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
      )
    ) {
      return fallback;
    }

    try {
      const body = {
        origin: { location: { latLng: { latitude: from.latitude, longitude: from.longitude } } },
        destination: {
          location: { latLng: { latitude: to.latitude, longitude: to.longitude } },
        },
        intermediates: waypoints.map((point) => ({
          location: {
            latLng: { latitude: point.latitude, longitude: point.longitude },
          },
        })),
        travelMode: 'DRIVE',
        routingPreference: preference,
        languageCode: 'en-NG',
        regionCode: 'NG',
      };

      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask':
              'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (response.status === 403) {
          this.googleDisabledUntil = Date.now() + 15 * 60_000;
        }
        const now = Date.now();
        if (now - this.lastGoogleWarnAt > 60_000) {
          this.lastGoogleWarnAt = now;
          this.log.warn(
            `Routes API ${response.status} — using estimate fallback. Enable Routes API on the Maps key if needed. ${text.slice(0, 120)}`,
          );
        }
        return fallback;
      }

      const payload = (await response.json()) as {
        routes?: {
          duration?: string;
          staticDuration?: string;
          distanceMeters?: number;
          polyline?: { encodedPolyline?: string };
        }[];
      };
      const route = payload.routes?.[0];
      if (!route) return fallback;

      const trafficSec = parseDurationSec(route.duration);
      const staticSec =
        parseDurationSec(route.staticDuration) || trafficSec;
      const metres = Number(route.distanceMeters) || 0;
      if (metres <= 0 || trafficSec <= 0) return fallback;

      return {
        ...packEstimate({
          km: Math.max(0.1, Number((metres / 1000).toFixed(1))),
          staticSec,
          trafficSec,
          source: 'google',
          routingPreference: preference,
        }),
        polyline: route.polyline?.encodedPolyline || undefined,
      };
    } catch (err) {
      this.log.warn(
        `Routes API failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return fallback;
    }
  }
}

function parseDurationSec(value?: string) {
  if (!value) return 0;
  const match = /^([\d.]+)s$/i.exec(value.trim());
  return match ? Number(match[1]) : 0;
}

function packEstimate(input: {
  km: number;
  staticSec: number;
  trafficSec: number;
  source: 'google' | 'estimate';
  routingPreference: RoutingPreference;
}): RouteEstimate {
  const staticSec = Math.max(1, input.staticSec);
  const trafficSec = Math.max(staticSec, input.trafficSec);
  const trafficDelaySec = Math.max(0, Math.round(trafficSec - staticSec));
  const delayPercentage = Number(
    ((trafficDelaySec / staticSec) * 100).toFixed(1),
  );
  const isTrafficHeavy =
    delayPercentage >= 30 && trafficDelaySec >= 5 * 60;

  return {
    km: input.km,
    minutes: Math.max(1, Math.round(trafficSec / 60)),
    staticMinutes: Math.max(1, Math.round(staticSec / 60)),
    trafficMinutes: Math.max(1, Math.round(trafficSec / 60)),
    trafficDelaySec,
    delayPercentage,
    isTrafficHeavy,
    source: input.source,
    routingPreference: input.routingPreference,
    computedAt: Date.now(),
  };
}
