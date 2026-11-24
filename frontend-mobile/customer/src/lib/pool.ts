import { ALONG_MATCH_KM, ALONG_SEATS, alongSeatFare, estimateFare, routeKm } from "./fare";
import { kmBetween, type Pin } from "./geo";
import type { Place } from "./places";

export type PoolRider = {
  id: string;
  name: string;
  pickup: Place;
  dropoff: Place;
  km: number;
  fare: number;
};

export type PoolCar = {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  colour: string;
  plate: string;
  latitude: number;
  longitude: number;
  heading: number;
  seats: number;
  taken: number;
  routePickup: Place;
  routeDropoff: Place;
  stops: Place[];
  riders: PoolRider[];
  routeQuote: number;
  area: string;
  etaMin: number;
};

export type PricedPool = PoolCar & { yourFare: number; yourKm: number };

function spot(id: string, label: string, latitude: number, longitude: number): Place {
  return { id, label, latitude, longitude };
}

const spots = {
  wuse: spot("wuse-market", "Wuse Market, Abuja", 9.0674, 7.4833),
  jabi: spot("jabi-lake", "Jabi Lake Mall, Abuja", 9.0762, 7.4255),
  garki: spot("garki-hospital", "Garki Hospital, Abuja", 9.0336, 7.4921),
  wuse2: spot("wuse-2", "Wuse 2, Abuja", 9.0772, 7.4784),
  maitama: spot("maitama", "Maitama, Abuja", 9.082, 7.495),
  airport: spot("airport", "Airport Road, Abuja", 9.006, 7.27),
  central: spot("central", "Central Area, Abuja", 9.057, 7.495),
  gwarinpa: spot("gwarinpa", "Gwarinpa estate gate, Abuja", 9.1126, 7.4114),
};

function rider(id: string, name: string, pickup: Place, dropoff: Place): PoolRider {
  const km = Number(routeKm(pickup, dropoff, []).toFixed(1));
  return { id, name, pickup, dropoff, km, fare: 0 };
}

function withFares(car: Omit<PoolCar, "routeQuote" | "taken"> & { riders: PoolRider[] }): PoolCar {
  const length = routeKm(car.routePickup, car.routeDropoff, car.stops);
  const routeQuote = estimateFare(length || 1, "ryde", "", false).quote;
  const riders = car.riders.map((item, index) => {
    const others = car.riders.filter((_, i) => i !== index).map((row) => row.km);
    return { ...item, fare: alongSeatFare(routeQuote, others, item.km) };
  });
  return { ...car, routeQuote, riders, taken: riders.length };
}

const fleet: PoolCar[] = [
  withFares({
    id: "pool_wuse_jabi",
    name: "Fatima Bello",
    rating: 4.96,
    vehicle: "Kia Rio",
    colour: "Blue",
    plate: "BDG-220FG",
    latitude: 9.07,
    longitude: 7.46,
    heading: 250,
    seats: ALONG_SEATS,
    routePickup: spots.wuse,
    routeDropoff: spots.jabi,
    stops: [spots.wuse2],
    riders: [rider("r1", "Chiamaka", spots.wuse, spots.jabi)],
    area: "Wuse → Jabi",
    etaMin: 4,
  }),
  withFares({
    id: "pool_garki_wuse",
    name: "Amaka Obi",
    rating: 4.93,
    vehicle: "Toyota Corolla",
    colour: "Silver",
    plate: "ABC-123AB",
    latitude: 9.04,
    longitude: 7.485,
    heading: 20,
    seats: ALONG_SEATS,
    routePickup: spots.garki,
    routeDropoff: spots.wuse2,
    stops: [],
    riders: [
      rider("r2", "Kunle", spots.garki, spots.wuse2),
      rider("r3", "Ada", spots.central, spots.wuse2),
    ],
    area: "Garki → Wuse",
    etaMin: 6,
  }),
  withFares({
    id: "pool_maitama_jabi",
    name: "Ibrahim Sule",
    rating: 4.88,
    vehicle: "Honda Accord",
    colour: "Black",
    plate: "LSD-441JK",
    latitude: 9.085,
    longitude: 7.48,
    heading: 220,
    seats: ALONG_SEATS,
    routePickup: spots.maitama,
    routeDropoff: spots.jabi,
    stops: [spots.wuse2],
    riders: [rider("r4", "Lara", spots.maitama, spots.jabi)],
    area: "Maitama → Jabi",
    etaMin: 7,
  }),
  withFares({
    id: "pool_airport_maitama",
    name: "Tunde Adebayo",
    rating: 4.9,
    vehicle: "Hyundai Elantra",
    colour: "White",
    plate: "FCT-908KL",
    latitude: 9.02,
    longitude: 7.32,
    heading: 40,
    seats: ALONG_SEATS,
    routePickup: spots.airport,
    routeDropoff: spots.maitama,
    stops: [],
    riders: [],
    area: "Airport → Maitama",
    etaMin: 9,
  }),
];

function sameArea(a: Place, b: Place) {
  const left = a.label.toLowerCase();
  const right = b.label.toLowerCase();
  const tokens = ["wuse", "jabi", "garki", "maitama", "gwarinpa", "airport", "central"];
  return tokens.some((token) => left.includes(token) && right.includes(token));
}

/** Cars already on a corridor near this pickup and heading toward a similar dropoff area. */
export function availablePools(pickup: Place | null, dropoff: Place | null): PricedPool[] {
  if (!pickup || !dropoff) return [];
  return fleet
    .filter((car) => car.taken < car.seats)
    .filter((car) => kmBetween(pickup, { latitude: car.latitude, longitude: car.longitude }) <= ALONG_MATCH_KM)
    .filter((car) => sameArea(dropoff, car.routeDropoff) || kmBetween(dropoff, car.routeDropoff) <= ALONG_MATCH_KM + 2)
    .map((car) => {
      const yourKm = Number(routeKm(pickup, dropoff, []).toFixed(1));
      const yourFare = alongSeatFare(car.routeQuote, car.riders.map((row) => row.km), yourKm);
      return { ...car, yourFare, yourKm };
    })
    .sort((a, b) => kmBetween(pickup, a) - kmBetween(pickup, b));
}

export function poolById(id: string) {
  return fleet.find((car) => car.id === id) ?? null;
}

export function seatsLeft(car: Pick<PoolCar, "seats" | "taken">) {
  return Math.max(0, car.seats - car.taken);
}

export function poolStops(car: PoolCar, youPickup?: Place | null, youDrop?: Place | null): Place[] {
  const rows = [car.routePickup, ...car.stops, ...car.riders.flatMap((row) => [row.pickup, row.dropoff])];
  if (youPickup) rows.push(youPickup);
  if (youDrop) rows.push(youDrop);
  rows.push(car.routeDropoff);
  const seen = new Set<string>();
  return rows.filter((item) => {
    const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function poolCarsOnMap(cars: PoolCar[]): Array<Pin & { id: string; heading: number }> {
  return cars.map((car) => ({
    id: car.id,
    latitude: car.latitude,
    longitude: car.longitude,
    heading: car.heading,
  }));
}
