import { fareBounds, SEARCH_RADIUS_KM } from "./fare";

type SampleDriver = {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  colour: string;
  plate: string;
  fare: number;
  sample: true;
  latitude: number;
  longitude: number;
};

/**
 * Demo drivers around pickup.
 * Near set stays inside the standard search radius; far set is only for extended search
 * and uses driver-set pricing (above the rider quote).
 */
export function sampleOffers(
  quote: number,
  pickupLat: number,
  pickupLng: number,
  opts?: { maxKm?: number; nearOnly?: boolean },
): SampleDriver[] {
  const { min, max } = fareBounds(quote);
  const maxKm = opts?.maxKm ?? SEARCH_RADIUS_KM;
  const nearOnly = opts?.nearOnly ?? false;

  /** ~0.009° ≈ 1 km at Abuja latitudes. */
  const deg = (km: number) => km / 111;

  const near: SampleDriver[] = [
    {
      id: "d_fatima",
      name: "Fatima Bello",
      rating: 4.96,
      vehicle: "Kia Rio",
      colour: "Blue",
      plate: "BDG-220FG",
      fare: min,
      sample: true,
      latitude: pickupLat + deg(1.6),
      longitude: pickupLng - deg(1.1),
    },
    {
      id: "d_amaka",
      name: "Amaka Obi",
      rating: 4.93,
      vehicle: "Toyota Corolla",
      colour: "Silver",
      plate: "ABC-123AB",
      fare: quote,
      sample: true,
      latitude: pickupLat + deg(2.4),
      longitude: pickupLng + deg(1.8),
    },
  ];

  const far: SampleDriver[] = [
    {
      id: "d_ibrahim",
      name: "Ibrahim Sule",
      rating: 4.88,
      vehicle: "Honda Accord",
      colour: "Black",
      plate: "LSD-441JK",
      fare: Math.max(max, Math.round(quote * 1.35)),
      sample: true,
      latitude: pickupLat - deg(7.2),
      longitude: pickupLng + deg(5.5),
    },
    {
      id: "d_chidi",
      name: "Chidi Okeke",
      rating: 4.85,
      vehicle: "Hyundai Elantra",
      colour: "White",
      plate: "ABC-908KN",
      fare: Math.max(max, Math.round(quote * 1.5)),
      sample: true,
      latitude: pickupLat + deg(9.5),
      longitude: pickupLng + deg(6.2),
    },
  ];

  const pool = nearOnly ? near : [...near, ...far];
  return pool.filter((driver) => {
    const dLat = (driver.latitude - pickupLat) * 111;
    const dLng = (driver.longitude - pickupLng) * 111 * Math.cos((pickupLat * Math.PI) / 180);
    const km = Math.hypot(dLat, dLng);
    return km <= maxKm;
  });
}
