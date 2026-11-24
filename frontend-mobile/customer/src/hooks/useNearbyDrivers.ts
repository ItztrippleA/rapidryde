import { useEffect, useState } from "react";
import { api, hasApi } from "../lib/api";
import type { NearbyCar } from "../lib/dummy";
import { SEARCH_RADIUS_KM } from "../lib/fare";

type Hub = { latitude: number; longitude: number } | null | undefined;

/**
 * Live available drivers near a map hub (pickup or current location).
 * Returns [] when offline / no API — never invents fake cars.
 */
export function useNearbyDrivers(hub: Hub, radiusKm = SEARCH_RADIUS_KM) {
  const [cars, setCars] = useState<NearbyCar[]>([]);

  useEffect(() => {
    if (!hasApi() || !hub || !Number.isFinite(hub.latitude) || !Number.isFinite(hub.longitude)) {
      setCars([]);
      return;
    }
    let alive = true;
    const pull = () => {
      void api<
        Array<{
          id: string;
          latitude: number;
          longitude: number;
          heading?: number | null;
        }>
      >(
        `/drivers/nearby?lat=${encodeURIComponent(String(hub.latitude))}&lng=${encodeURIComponent(String(hub.longitude))}&radiusKm=${encodeURIComponent(String(radiusKm))}&city=abuja`,
      )
        .then((rows) => {
          if (!alive || !Array.isArray(rows)) return;
          setCars(
            rows.map((row) => ({
              id: row.id,
              latitude: row.latitude,
              longitude: row.longitude,
              heading:
                row.heading != null && Number.isFinite(row.heading) && row.heading >= 0
                  ? row.heading
                  : 0,
            })),
          );
        })
        .catch(() => {
          if (alive) setCars([]);
        });
    };
    pull();
    const timer = setInterval(pull, 8_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hub?.latitude, hub?.longitude, radiusKm]);

  return cars;
}
