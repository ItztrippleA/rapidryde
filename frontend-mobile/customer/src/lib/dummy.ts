import type { CustomerTrip, DriverCard, Ledger } from "../store/useCustomerStore";
import type { Place } from "./places";
import { kmBetween, type Pin } from "./geo";
import { deskPlaces } from "./places";

const FARE = 6000;

const drivers: Omit<DriverCard, "latitude" | "longitude" | "fare" | "sample">[] = [
  { id: "d_fatima", name: "Fatima Bello", rating: 4.96, vehicle: "Kia Rio", colour: "Blue", plate: "BDG-220FG" },
  { id: "d_amaka", name: "Amaka Obi", rating: 4.93, vehicle: "Toyota Corolla", colour: "Silver", plate: "ABC-123AB" },
  { id: "d_ibrahim", name: "Ibrahim Sule", rating: 4.88, vehicle: "Honda Accord", colour: "Black", plate: "LSD-441JK" },
];

const routes: Array<{ pickup: Place; dropoff: Place; km: number; minutes: number }> = [
  { pickup: place("wuse-market", "Wuse Market, Abuja", 9.0674, 7.4833), dropoff: place("jabi-lake", "Jabi Lake Mall, Abuja", 9.0762, 7.4255), km: 6.2, minutes: 18 },
  { pickup: place("garki-hospital", "Garki Hospital, Abuja", 9.0336, 7.4921), dropoff: place("wuse-2", "Wuse 2, Abuja", 9.0772, 7.4784), km: 3.1, minutes: 12 },
  { pickup: place("airport", "Airport Road, Abuja", 9.006, 7.27), dropoff: place("maitama", "Maitama, Abuja", 9.082, 7.495), km: 14, minutes: 28 },
  { pickup: place("maitama", "Maitama, Abuja", 9.082, 7.495), dropoff: place("jabi-lake", "Jabi Lake Mall, Abuja", 9.0762, 7.4255), km: 8, minutes: 20 },
  { pickup: place("wuse-2", "Wuse 2, Abuja", 9.0772, 7.4784), dropoff: place("gwarinpa", "Gwarinpa estate gate, Abuja", 9.1126, 7.4114), km: 9.4, minutes: 22 },
  { pickup: place("central", "Central Area, Abuja", 9.057, 7.495), dropoff: place("garki-hospital", "Garki Hospital, Abuja", 9.0336, 7.4921), km: 4.5, minutes: 14 },
];

function place(id: string, label: string, latitude: number, longitude: number): Place {
  return { id, label, latitude, longitude };
}

export function dummyTrips(now = Date.now()): CustomerTrip[] {
  return Array.from({ length: 12 }, (_, index) => {
    const route = routes[index % routes.length];
    const person = drivers[index % drivers.length];
    const daysAgo = Math.floor(index / 2);
    const when = new Date(now);
    when.setDate(when.getDate() - daysAgo);
    when.setHours(index % 2 === 0 ? 8 : 17, (index * 7) % 60, 0, 0);
    const endedAt = when.getTime();
    const payment = (["cash", "wallet", "card"] as const)[index % 3];
    return {
      id: `hist_${daysAgo}_${index}`,
      pickup: route.pickup,
      dropoff: route.dropoff,
      stops: [],
      classId: "ryde",
      classLabel: "Ryde",
      fare: FARE,
      quote: FARE,
      payment,
      fareTalk: "agreed",
      stage: "completed",
      driver: { ...person, fare: FARE, sample: true, latitude: route.pickup.latitude, longitude: route.pickup.longitude },
      sample: true,
      scheduledAt: null,
      startedAt: endedAt - route.minutes * 60_000,
      endedAt,
      rating: index % 4 === 0 ? 5 : 0,
      review: "",
      km: route.km,
      minutes: route.minutes,
      issue: "",
    };
  });
}

export function dummyWallet(trips: CustomerTrip[]) {
  const spent = trips.filter((trip) => trip.payment === "wallet");
  const topup = 40_000;
  const ledger: Ledger[] = [
    { id: "led_topup", label: "Added money", amount: topup, at: Date.now() - 3 * 86_400_000, pending: false },
    ...spent.map((trip) => ({
      id: `led_${trip.id}`,
      label: `${trip.pickup.label.split(",")[0]} → ${trip.dropoff.label.split(",")[0]}`,
      amount: -trip.fare,
      at: trip.endedAt,
      pending: false,
    })),
  ].sort((a, b) => b.at - a.at);
  const wallet = ledger.reduce((sum, row) => sum + row.amount, 0);
  return { wallet, pending: 0, ledger };
}

export function dummyRecent(trips: CustomerTrip[]) {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const trip of trips) {
    const key = trip.dropoff.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(trip.dropoff);
  }
  return places.slice(0, 8);
}

export function dummyScheduled(now = Date.now()): CustomerTrip {
  const route = routes[0];
  const when = new Date(now);
  when.setDate(when.getDate() + 1);
  when.setHours(8, 30, 0, 0);
  return {
    id: "sched_demo",
    pickup: route.pickup,
    dropoff: route.dropoff,
    stops: [],
    classId: "ryde",
    classLabel: "Ryde",
    fare: FARE,
    quote: FARE,
    payment: "cash",
    fareTalk: "agreed",
    stage: "scheduled",
    driver: null,
    sample: true,
    scheduledAt: when.getTime(),
    startedAt: now,
    endedAt: 0,
    rating: 0,
    review: "",
    km: route.km,
    minutes: route.minutes,
    issue: "",
  };
}

export function customerDummy() {
  const trips = dummyTrips();
  const money = dummyWallet(trips);
  return {
    ...money,
    trips,
    recent: dummyRecent(trips),
    scheduled: [dummyScheduled()],
    home: deskPlaces.find((item) => item.id === "gwarinpa") ?? null,
    work: deskPlaces.find((item) => item.id === "wuse-2") ?? null,
    notices: [{ id: "n_hist", title: "Ride completed", body: "Wuse Market to Jabi Lake Mall.", at: trips[0]?.endedAt ?? Date.now(), read: false }],
  };
}

export type NearbyCar = Pin & { id: string; heading: number };

const offsets: Array<[number, number, number]> = [
  [0.008, -0.006, 30],
  [-0.007, 0.009, 110],
  [0.004, 0.011, 200],
  [-0.011, -0.003, 250],
  [0.012, 0.002, 70],
  [-0.002, -0.01, 160],
];

export function nearbyCars(origin: Pin): NearbyCar[] {
  return offsets.map(([dLat, dLng, heading], index) => ({
    id: `car_${index}`,
    latitude: origin.latitude + dLat,
    longitude: origin.longitude + dLng,
    heading,
  }));
}

/** Degrees clockwise from north, from one position to the next. */
export function bearing(from: Pin, to: Pin) {
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const delta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(delta) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(delta);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Move a car along its heading, and turn back when it leaves the rider. */
export function stepCar(car: NearbyCar, origin: Pin): NearbyCar {
  let heading = car.heading;
  if (kmBetween(car, origin) > 1.6) heading = bearing(car, origin);
  else if (Math.random() < 0.18) heading = heading + (Math.random() * 46 - 23);
  const rad = (heading * Math.PI) / 180;
  const step = 0.00042;
  return {
    ...car,
    heading: (heading + 360) % 360,
    latitude: car.latitude + Math.cos(rad) * step,
    longitude: car.longitude + (Math.sin(rad) * step) / Math.max(0.2, Math.cos((origin.latitude * Math.PI) / 180)),
  };
}
