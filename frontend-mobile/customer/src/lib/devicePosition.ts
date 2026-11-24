import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Location from "expo-location";
import type { Pin } from "./geo";

/** Default when the emulator has no simulated GPS fix. */
export const DEV_FALLBACK_PIN: Pin = { latitude: 9.0765, longitude: 7.3986 };

export type DevicePositionResult =
  | { ok: true; pin: Pin; heading?: number | null; source: "gps" | "last" | "store" | "simulator" }
  | { ok: false; reason: "denied" | "unavailable" };

/** Same check the driver app uses — simulators often never deliver a fix. */
export function onSimulator() {
  if (Constants.isDevice === false) return true;
  if (Platform.OS === "ios") {
    const model = Constants.platform?.ios?.platform ?? "";
    return model === "" || /^(arm64|x86_64|i386)$/.test(model);
  }
  if (Platform.OS === "android") {
    const fingerprint = String(
      (Platform.constants as { Fingerprint?: string; Model?: string }).Fingerprint ?? "",
    );
    const model = String((Platform.constants as { Model?: string }).Model ?? "");
    return /generic|emulator|sdk_gphone|google_sdk/i.test(`${fingerprint} ${model}`);
  }
  return false;
}

function fromCoords(
  coords: { latitude: number; longitude: number; heading?: number | null },
  source: "gps" | "last" | "store" | "simulator",
): DevicePositionResult {
  return {
    ok: true,
    pin: { latitude: coords.latitude, longitude: coords.longitude },
    heading:
      coords.heading != null && Number.isFinite(coords.heading) && coords.heading >= 0
        ? coords.heading
        : null,
    source,
  };
}

async function tryCurrent(accuracy: Location.LocationAccuracy, timeoutMs: number) {
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]).catch(() => null);
}

/**
 * Foreground GPS with timeouts, last-known, store, and emulator fallbacks.
 * Lat/lng come straight from Expo Location coords — no geocode step here.
 * Address labels are resolved separately via reverseGeocodeLabel.
 */
export async function readDevicePosition(
  timeoutMs = 6_000,
  fallback?: Pin | null,
): Promise<DevicePositionResult> {
  const simulator = onSimulator();

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      if (simulator) {
        return fromCoords(fallback || DEV_FALLBACK_PIN, "simulator");
      }
      return { ok: false, reason: "denied" };
    }

    const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!servicesOn && !simulator) {
      return { ok: false, reason: "unavailable" };
    }

    // Lowest first — emulator / weak GPS often never satisfies Balanced.
    const current =
      (await tryCurrent(Location.Accuracy.Lowest, Math.min(timeoutMs, 4_000))) ||
      (await tryCurrent(Location.Accuracy.Balanced, timeoutMs));

    if (current?.coords) {
      return fromCoords(
        {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          heading: current.coords.heading,
        },
        "gps",
      );
    }

    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last?.coords) {
      return fromCoords(
        {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          heading: last.coords.heading,
        },
        "last",
      );
    }

    if (fallback && Number.isFinite(fallback.latitude) && Number.isFinite(fallback.longitude)) {
      return fromCoords(fallback, "store");
    }

    if (simulator || __DEV__) {
      return fromCoords(DEV_FALLBACK_PIN, "simulator");
    }

    return { ok: false, reason: "unavailable" };
  } catch {
    if (simulator || __DEV__) {
      return fromCoords(fallback || DEV_FALLBACK_PIN, "simulator");
    }
    return { ok: false, reason: "unavailable" };
  }
}
