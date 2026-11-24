import type {
  Activity,
  AppConfig,
  ChatThread,
  Customer,
  Delivery,
  DeliveryZone,
  Driver,
  NoticeTemplate,
  OutboxItem,
  Plan,
  Pricing,
  Promo,
  Ride,
  RideZone,
  Staff,
  Subscription,
} from "@/lib/types";

/** Operational desks start empty — live API fills drivers, customers, rides, support. */
export const drivers: Driver[] = [];
export const customers: Customer[] = [];
export const rides: Ride[] = [];
export const deliveries: Delivery[] = [];
export const subscriptions: Subscription[] = [];
export const promos: Promo[] = [];
export const outbox: OutboxItem[] = [];
export const chats: ChatThread[] = [];
export const activity: Activity[] = [];

export const plans: Plan[] = [
  {
    id: "p_care",
    name: "Driver Care",
    audience: "driver",
    price: 4500,
    interval: "week",
    perk: "Fuel partner codes and a written earnings summary.",
    commissionPercent: null,
    active: true,
  },
  {
    id: "p_pro",
    name: "Driver Pro",
    audience: "driver",
    price: 15000,
    interval: "month",
    perk: "Commission drops to the plan rate while the week is paid.",
    commissionPercent: 12,
    active: true,
  },
  {
    id: "p_plus",
    name: "Rapyd Plus",
    audience: "customer",
    price: 2500,
    interval: "month",
    perk: "10% off city rides, capped, on top of a promo.",
    commissionPercent: null,
    active: true,
  },
];

export const rideZones: RideZone[] = [];
export const deliveryZones: DeliveryZone[] = [];

export const templates: NoticeTemplate[] = [
  {
    id: "n_assign",
    channel: "native",
    audience: "drivers",
    name: "Trip assigned",
    title: "A trip is yours",
    body: "Pickup, landmark note, and the fare are on the offer. Accept before the window closes.",
    enabled: true,
  },
  {
    id: "n_pin",
    channel: "native",
    audience: "customers",
    name: "Trip PIN",
    title: "Your trip PIN",
    body: "Share the PIN only with the driver at the car. It expires when the trip starts.",
    enabled: true,
  },
  {
    id: "n_receipt",
    channel: "email",
    audience: "customers",
    name: "Receipt",
    title: "Your Rapyd Ryd receipt",
    body: "The fare, the distance, and the payment line are attached.",
    enabled: true,
  },
  {
    id: "n_payout",
    channel: "email",
    audience: "drivers",
    name: "Earnings",
    title: "Today's earnings",
    body: "Gross, commission, and take-home before fuel.",
    enabled: true,
  },
  {
    id: "n_sos",
    channel: "native",
    audience: "both",
    name: "SOS opened",
    title: "A safety case is open",
    body: "Support has the trip. Stay on the line if you can.",
    enabled: true,
  },
];

export const pricing: Pricing = {
  baseFare: 400,
  perKm: 140,
  perMinute: 25,
  minimumFare: 700,
  bookingFee: 100,
  cancellationFee: 300,
  waitPerMinute: 40,
  commissionPercent: 10,
  airportMultiplier: 1.35,
  nightMultiplier: 1.15,
  rainMultiplier: 1.2,
  intercityPerKm: 180,
  distanceMode: "banded",
  bands: [
    { id: "b1", label: "First 3 km", upToKm: 3, perKm: 180 },
    { id: "b2", label: "3 to 10 km", upToKm: 10, perKm: 140 },
    { id: "b3", label: "Beyond 10 km", upToKm: null, perKm: 110 },
  ],
  classes: [
    { id: "ryde", label: "Ryde", multiplier: 1 },
    { id: "comfort", label: "Comfort", multiplier: 1.35 },
    { id: "xl", label: "XL", multiplier: 1.55 },
    { id: "executive", label: "Executive", multiplier: 2.05 },
    { id: "green", label: "Green", multiplier: 1.12 },
    { id: "moto", label: "Moto", multiplier: 0.62 },
    { id: "keke", label: "Keke", multiplier: 0.55 },
    { id: "along", label: "Along", multiplier: 0.72 },
  ],
};

export const config: AppConfig = {
  abujaLive: true,
  lagosLive: true,
  ninRequired: true,
  stillPlay: true,
  supportEmail: "care@rapydryd.com",
  supportPhone: "+234 700 729 3743",
  searchRadiusKm: 6,
  offerWindowSec: 20,
  driver: {
    minVersion: "1.0.0",
    documentsRequired: true,
    destinationFilter: true,
    demandMap: true,
    maxOnlineHours: 12,
  },
  customer: {
    minVersion: "1.0.0",
    yourPrice: true,
    maxStops: 2,
    shareTrip: true,
    sos: true,
    quietRide: true,
    scheduleAheadHours: 72,
  },
};

/** Desk login accounts (local console auth until SSO). */
export const staff: Staff[] = [
  { id: "st_ada", name: "Ada Okonkwo", email: "ada@rapydryd.com", password: "owner", role: "owner", status: "active" },
  { id: "st_tobi", name: "Tobi Ade", email: "tobi@rapydryd.com", password: "operations", role: "operations", status: "active" },
  { id: "st_nneka", name: "Nneka Udo", email: "nneka@rapydryd.com", password: "support", role: "support", status: "active" },
  { id: "st_femi", name: "Femi Lawal", email: "femi@rapydryd.com", password: "finance", role: "finance", status: "active" },
  { id: "st_chioma", name: "Chioma Edet", email: "chioma@rapydryd.com", password: "viewer", role: "viewer", status: "active" },
];

export function freshData() {
  return {
    drivers,
    customers,
    plans,
    subscriptions,
    rideZones,
    deliveryZones,
    rides,
    deliveries,
    promos,
    templates,
    outbox,
    pricing,
    config,
    activity,
    staff,
    chats,
  };
}
