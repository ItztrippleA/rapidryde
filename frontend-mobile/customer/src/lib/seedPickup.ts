import { readDevicePosition } from "./devicePosition";
import { isGenericPlaceLabel, reverseGeocodeLabel, type Place } from "./places";
import { useCustomerStore } from "../store/useCustomerStore";

/**
 * Read GPS, store coords, and set booking pickup when missing or still the
 * auto "current location" pin. Pass `force` after sign-in / sign-up.
 */
export async function seedPickupFromGps(options?: { force?: boolean }): Promise<Place | null> {
  try {
    const store = useCustomerStore.getState();
    const fix = await readDevicePosition(6_000, store.coords);
    if (!fix.ok) return null;

    const pin = fix.pin;
    const label =
      (await reverseGeocodeLabel(pin)) ||
      (fix.source === "simulator" ? "Current location (simulator)" : "Current location");
    const place: Place = { id: "here", label, ...pin };

    store.setCoords(pin);

    const pickup = store.booking.pickup;
    const shouldSet =
      options?.force === true ||
      !pickup ||
      pickup.id === "here" ||
      isGenericPlaceLabel(pickup.label);

    if (shouldSet) store.setPickup(place);
    return place;
  } catch {
    return null;
  }
}
