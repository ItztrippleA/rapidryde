import Constants from "expo-constants";
import { readToken, refreshSession } from "./session";

export const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
export const rideBase = process.env.EXPO_PUBLIC_RIDE_URL?.replace(/\/$/, "") ?? "";

function mapsKeyFromConfig() {
  const config = Constants.expoConfig;
  const ios = config?.ios?.config?.googleMapsApiKey;
  const android = config?.android?.config as { googleMaps?: { apiKey?: string } } | undefined;
  return ios || android?.googleMaps?.apiKey || "";
}

/** Client Maps/Places keys — never commit real keys; use EAS secrets / .env */
export const placesKey = (
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
  mapsKeyFromConfig() ||
  ""
).trim();
export const paystackKey = process.env.EXPO_PUBLIC_PAYSTACK_KEY ?? "";

export function hasApi() {
  return apiBase.length > 0;
}

export function hasRideService() {
  return rideBase.length > 0;
}

export function hasPaystack() {
  return paystackKey.length > 0 || hasApi();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  if (!apiBase) throw new ApiError(0, "NO_API");
  const token = await readToken();
  const url = `${apiBase}${path}`;
  const method = (init?.method || "GET").toUpperCase();
  console.log(`[api] → ${method} ${url}`);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    // Warn (not error) so LogBox does not spam a redbox on transient offline / IPv6 miss.
    console.warn(`[api] network error ${method} ${url}`, error);
    throw new ApiError(0, `Could not reach ${apiBase}. Is the API running?`);
  }
  // Auth routes return 401 for bad OTP / credentials — never treat those as session refresh.
  const authRoute = path.startsWith("/auth/");
  if (response.status === 401 && attempt === 0 && !authRoute) {
    const renewed = await refreshSession();
    if (renewed) return api<T>(path, init, 1);
    console.warn(`[api] ← 401 ${method} ${url}`);
    throw new ApiError(401, "SESSION");
  }
  if (!response.ok) {
    let message = "The service could not complete that.";
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === "string") message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(", ");
    } catch {
      /* keep the generic message */
    }
    // Expected client errors (409 conflict, 400 validation) — warn, don't throw a red LogBox.
    console.warn(`[api] ← ${response.status} ${method} ${url}: ${message}`);
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) {
    console.log(`[api] ← 204 ${method} ${url}`);
    return undefined as T;
  }
  const json = (await response.json()) as T;
  console.log(`[api] ← ${response.status} ${method} ${url}`, json);
  return json;
}
