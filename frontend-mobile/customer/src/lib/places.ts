import * as Location from "expo-location";
import { uid } from "./format";
import { placesKey } from "./api";
import type { Pin } from "./geo";

export type Place = Pin & {
  id: string;
  label: string;
};

/** Places already named on the desk. Used when Places has no key. */
export const deskPlaces: Place[] = [
  { id: "wuse-market", label: "Wuse Market, Abuja", latitude: 9.0674, longitude: 7.4833 },
  { id: "jabi-lake", label: "Jabi Lake Mall, Abuja", latitude: 9.0762, longitude: 7.4255 },
  { id: "garki-hospital", label: "Garki Hospital, Abuja", latitude: 9.0336, longitude: 7.4921 },
  { id: "wuse-2", label: "Wuse 2, Abuja", latitude: 9.0772, longitude: 7.4784 },
  { id: "national-hospital", label: "National Hospital, Abuja", latitude: 9.0484, longitude: 7.4608 },
  { id: "gwarinpa", label: "Gwarinpa estate gate, Abuja", latitude: 9.1126, longitude: 7.4114 },
];

export function placesReady() {
  return placesKey.length > 0;
}

export function nearbyPlaces() {
  return deskPlaces;
}

export function filterDesk(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return deskPlaces;
  return deskPlaces.filter((place) => place.label.toLowerCase().includes(q));
}

export async function suggestAddresses(input: string, origin?: { latitude: number; longitude: number } | null): Promise<Place[]> {
  const query = input.trim();
  const local = filterDesk(query);
  if (!placesKey || query.length < 2) return local;

  // Legacy Autocomplete — same API as react-native-google-places-autocomplete.
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", query);
    url.searchParams.set("key", placesKey);
    url.searchParams.set("components", "country:ng");
    url.searchParams.set(
      "location",
      `${origin?.latitude ?? 9.0765},${origin?.longitude ?? 7.3986}`,
    );
    url.searchParams.set("radius", "80000");
    const response = await fetch(url.toString());
    if (response.ok) {
      const body = (await response.json()) as {
        status?: string;
        predictions?: { place_id?: string; description?: string }[];
      };
      if (body.status === "OK" || body.status === "ZERO_RESULTS") {
        const remote = (body.predictions ?? [])
          .map((item) => ({
            id: item.place_id ?? "",
            label: item.description ?? "",
            latitude: 0,
            longitude: 0,
          }))
          .filter((item) => item.id && item.label);
        if (remote.length) return remote;
      }
    }
  } catch {
    /* try Places API (New) below */
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesKey,
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["ng"],
        languageCode: "en",
        regionCode: "NG",
        locationBias: {
          circle: {
            center: {
              latitude: origin?.latitude ?? 9.0765,
              longitude: origin?.longitude ?? 7.3986,
            },
            radius: 80000,
          },
        },
      }),
    });
    if (!response.ok) return local;
    const body = (await response.json()) as {
      suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
    };
    const remote = (body.suggestions ?? [])
      .map((item) => ({
        id: item.placePrediction?.placeId ?? "",
        label: item.placePrediction?.text?.text ?? "",
        latitude: 0,
        longitude: 0,
      }))
      .filter((item) => item.id && item.label);
    return remote.length ? remote : local;
  } catch {
    return local;
  }
}

export async function placeDetails(place: Place): Promise<Place> {
  if (!placesKey || (place.latitude !== 0 && place.longitude !== 0)) return place;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", place.id.replace(/^places\//, ""));
    url.searchParams.set("fields", "place_id,formatted_address,geometry,name");
    url.searchParams.set("key", placesKey);
    const response = await fetch(url.toString());
    if (response.ok) {
      const body = (await response.json()) as {
        result?: {
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        };
      };
      const loc = body.result?.geometry?.location;
      if (loc?.lat != null && loc?.lng != null) {
        return {
          id: place.id,
          label: place.label || body.result?.formatted_address || "Selected place",
          latitude: loc.lat,
          longitude: loc.lng,
        };
      }
    }
  } catch {
    /* try Places API (New) */
  }

  const placeId = place.id.startsWith("places/") ? place.id : `places/${place.id}`;
  const response = await fetch(`https://places.googleapis.com/v1/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": placesKey,
      "X-Goog-FieldMask": "id,formattedAddress,location",
    },
  });
  if (!response.ok) return place;
  const body = (await response.json()) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };
  return {
    id: place.id,
    label: place.label || body.formattedAddress || "Selected place",
    latitude: body.location?.latitude ?? place.latitude,
    longitude: body.location?.longitude ?? place.longitude,
  };
}

export function pinnedPlace(pin: Pin, label = "Pinned on the map"): Place {
  return { id: uid("pin"), label, latitude: pin.latitude, longitude: pin.longitude };
}

export function isGenericPlaceLabel(label?: string | null) {
  const text = (label || "").trim();
  return !text || /^pinned on the map$/i.test(text) || /^current location$/i.test(text);
}

/** Fill in a Google/area name when a place still has a generic pin label. */
export async function resolvePlaceLabel(place: Place): Promise<Place> {
  if (!isGenericPlaceLabel(place.label)) return place;
  const label = await reverseGeocodeLabel(place);
  return label ? { ...place, label } : place;
}

/** Resolve a map pin to a street/area name, falling back to a broader place name. */
export async function resolvePinnedPlace(pin: Pin): Promise<Place> {
  const label = (await reverseGeocodeLabel(pin)) || "Pinned on the map";
  return pinnedPlace(pin, label);
}

const labelCache = new Map<string, string>();

function pinKey(place: { latitude: number; longitude: number }) {
  return `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
}

async function resolveCached(place: Place): Promise<Place> {
  if (!isGenericPlaceLabel(place.label)) return place;
  const key = pinKey(place);
  const cached = labelCache.get(key);
  if (cached) return { ...place, label: cached };
  const next = await resolvePlaceLabel(place);
  if (!isGenericPlaceLabel(next.label)) labelCache.set(key, next.label);
  return next;
}

/** Backfill trip / recent places that still say "Pinned on the map". */
export async function backfillGenericPlaceLabels(input: {
  trips?: Array<{ pickup: Place; dropoff: Place; stops?: Place[] }>;
  recent?: Place[];
  scheduled?: Array<{ pickup: Place; dropoff: Place; stops?: Place[] }>;
  trip?: { pickup: Place; dropoff: Place; stops?: Place[] } | null;
  booking?: { pickup: Place | null; dropoff: Place | null; stops?: Place[] } | null;
}) {
  const trips = input.trips
    ? await Promise.all(
        input.trips.map(async (trip) => ({
          ...trip,
          pickup: await resolveCached(trip.pickup),
          dropoff: await resolveCached(trip.dropoff),
          stops: trip.stops ? await Promise.all(trip.stops.map((stop) => resolveCached(stop))) : trip.stops,
        })),
      )
    : undefined;
  const recent = input.recent ? await Promise.all(input.recent.map((place) => resolveCached(place))) : undefined;
  const scheduled = input.scheduled
    ? await Promise.all(
        input.scheduled.map(async (trip) => ({
          ...trip,
          pickup: await resolveCached(trip.pickup),
          dropoff: await resolveCached(trip.dropoff),
          stops: trip.stops ? await Promise.all(trip.stops.map((stop) => resolveCached(stop))) : trip.stops,
        })),
      )
    : undefined;
  const trip = input.trip
    ? {
        ...input.trip,
        pickup: await resolveCached(input.trip.pickup),
        dropoff: await resolveCached(input.trip.dropoff),
        stops: input.trip.stops ? await Promise.all(input.trip.stops.map((stop) => resolveCached(stop))) : input.trip.stops,
      }
    : input.trip;
  const booking = input.booking
    ? {
        ...input.booking,
        pickup: input.booking.pickup ? await resolveCached(input.booking.pickup) : null,
        dropoff: input.booking.dropoff ? await resolveCached(input.booking.dropoff) : null,
        stops: input.booking.stops ? await Promise.all(input.booking.stops.map((stop) => resolveCached(stop))) : input.booking.stops,
      }
    : input.booking;
  return { trips, recent, scheduled, trip, booking };
}

type AddressPart = { long_name?: string; short_name?: string; types?: string[] };

function componentName(parts: AddressPart[] | undefined, type: string) {
  return parts?.find((part) => part.types?.includes(type))?.long_name?.trim() || "";
}

function labelFromGoogleComponents(parts: AddressPart[] | undefined, formatted?: string) {
  const streetNumber = componentName(parts, "street_number");
  const route = componentName(parts, "route");
  const premise = componentName(parts, "premise");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim() || premise;
  const area =
    componentName(parts, "neighborhood") ||
    componentName(parts, "sublocality_level_1") ||
    componentName(parts, "sublocality") ||
    componentName(parts, "administrative_area_level_3");
  const city =
    componentName(parts, "locality") ||
    componentName(parts, "administrative_area_level_2") ||
    componentName(parts, "postal_town");
  if (street && (area || city)) return `${street}, ${area || city}`;
  if (street) return street;
  if (area && city && area !== city) return `${area}, ${city}`;
  if (area) return area;
  if (city) return city;
  const first = (formatted || "").split(",")[0]?.trim();
  return first || "";
}

function labelFromExpoAddress(parts: Location.LocationGeocodedAddress) {
  const street = [parts.streetNumber, parts.street].filter(Boolean).join(" ").trim();
  const area = parts.district || "";
  const city = parts.city || "";
  if (street && (area || city)) return `${street}, ${area || city}`;
  if (street) return street;
  if (parts.name && parts.name !== city && parts.name !== street) {
    return city ? `${parts.name}, ${city}` : parts.name;
  }
  if (area && city && area !== city) return `${area}, ${city}`;
  if (area) return area;
  if (city) return parts.region ? `${city}, ${parts.region}` : city;
  if (parts.region) return parts.region;
  return "";
}

export async function reverseGeocodeLabel(pin: Pin): Promise<string> {
  if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) return "";

  if (placesKey) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${pin.latitude},${pin.longitude}`);
      url.searchParams.set("key", placesKey);
      url.searchParams.set("language", "en");
      const response = await fetch(url.toString());
      if (response.ok) {
        const body = (await response.json()) as {
          status?: string;
          results?: { formatted_address?: string; address_components?: AddressPart[]; types?: string[] }[];
        };
        if (body.status === "OK" && body.results?.length) {
          const ranked = [...body.results].sort((a, b) => scoreGeocodeResult(b) - scoreGeocodeResult(a));
          for (const result of ranked) {
            const label = labelFromGoogleComponents(result.address_components, result.formatted_address);
            if (label) return label;
          }
        }
      }
    } catch {
      /* fall through to expo reverse geocode */
    }
  }

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: pin.latitude,
      longitude: pin.longitude,
    });
    for (const result of results) {
      const label = labelFromExpoAddress(result);
      if (label) return label;
    }
  } catch {
    /* no label */
  }
  return "";
}

function scoreGeocodeResult(result: { types?: string[] }) {
  const types = result.types ?? [];
  if (types.includes("street_address")) return 50;
  if (types.includes("premise")) return 40;
  if (types.includes("route")) return 30;
  if (types.includes("neighborhood") || types.includes("sublocality") || types.includes("sublocality_level_1")) return 20;
  if (types.includes("locality")) return 10;
  return 0;
}
