export type CityId = "abuja" | "lagos";
export type AccountStatus = "active" | "suspended" | "pending" | "closed";
export type NinStatus = "pending" | "verified" | "failed";
export type RideClassId = "ryde" | "comfort" | "xl" | "executive" | "green" | "moto" | "keke" | "along";
export type DeliveryKind = "courier" | "freight" | "food" | "grocery";
export type RideStatus = "searching" | "assigned" | "on_trip" | "completed" | "cancelled";
export type DeliveryStatus = "new" | "assigned" | "picked_up" | "delivered" | "cancelled";
export type PromoKind = "percent" | "amount";
export type NoticeChannel = "email" | "native";
export type Audience = "drivers" | "customers" | "both";

/** Soft: can log in, no offers. Hard: inactive, cannot log in (forced logout). */
export type BanKind = "soft" | "hard" | null;

export type ComplaintMeterLevel = "clear" | "watch" | "alert" | "critical";

export interface Driver {
  id: string;
  /** Public desk code, e.g. RRD-3456. Optional until backfilled. */
  code?: string;
  name: string;
  phone: string;
  email: string;
  city: CityId;
  ninStatus: NinStatus;
  status: AccountStatus;
  /** null when not banned. Soft keeps status suspended; hard keeps status closed. */
  banKind?: BanKind;
  banReason?: string;
  bannedAt?: string;
  online: boolean;
  rating: number;
  trips: number;
  /** Rider complaints logged against this driver. */
  complaintCount?: number;
  lastComplaintAt?: string;
  vehicle: string;
  plate: string;
  classId: RideClassId;
  x: number;
  y: number;
  papers: "valid" | "expiring" | "expired";
  earningsToday: number;
  profile?: DriverProfile;
}

export interface DriverProfile {
  middleName: string;
  dob: string;
  gender: "" | "Female" | "Male" | "Prefer not to say";
  address: string;
  state: string;
  lga: string;
  licenceNumber: string;
  licenceExpiry: string;
  colour: string;
  year: string;
  category: string;
  fuelType: string;
  inspection: "not_scheduled" | "scheduled" | "in_progress" | "approved" | "rejected" | "resubmit";
  bankName: string;
  maskedAccount: string;
  bankStatus: "missing" | "pending" | "verified" | "failed";
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
}

export interface Customer {
  id: string;
  /** Public desk code, e.g. RR-2342. Optional until backfilled. */
  code?: string;
  name: string;
  phone: string;
  email: string;
  city: CityId;
  ninStatus: NinStatus;
  status: AccountStatus;
  rating: number;
  trips: number;
  wallet: number;
  rideSpend: number;
  joined: string;
}

export interface Plan {
  id: string;
  name: string;
  audience: "driver" | "customer";
  price: number;
  interval: "week" | "month";
  perk: string;
  commissionPercent: number | null;
  active: boolean;
}

export type SubscriptionPayment = "card" | "wallet" | "direct_transfer";

export interface Subscription {
  id: string;
  planId: string;
  holder: "driver" | "customer";
  holderId: string;
  status: "active" | "past_due" | "cancelled" | "pending_transfer";
  renewsOn: string;
  /** How the period was paid. Direct transfer is matched with holderCode. */
  paymentMethod?: SubscriptionPayment;
  /** Public code used as bank narration, e.g. RRD-3456 / RR-2342. */
  holderCode?: string;
  /** Optional bank reference from the statement. */
  transferRef?: string;
  notedAt?: string;
}

export interface RideZone {
  id: string;
  name: string;
  city: CityId;
  active: boolean;
  surge: number;
  minFare: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  city: CityId;
  active: boolean;
  fee: number;
  maxKm: number;
  services: DeliveryKind[];
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PoolRider {
  name: string;
  pickup: string;
  dropoff: string;
  fare: number;
  /** 0 = front passenger, 1 = rear left, 2 = rear right */
  seatIndex?: number;
  seatLabel?: string;
}

export interface Ride {
  id: string;
  city: CityId;
  customerId: string;
  driverId: string | null;
  classId: RideClassId;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fare: number;
  status: RideStatus;
  when: string;
  /** Along / shared car */
  along?: boolean;
  poolId?: string;
  seatsTotal?: number;
  riders?: PoolRider[];
}

export interface Delivery {
  id: string;
  kind: DeliveryKind;
  city: CityId;
  customerId: string;
  driverId: string | null;
  zoneId: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fee: number;
  status: DeliveryStatus;
  note: string;
}

export interface Promo {
  id: string;
  code: string;
  name: string;
  kind: PromoKind;
  value: number;
  cap: number | null;
  minFare: number;
  audience: Audience;
  active: boolean;
  uses: number;
  maxUses: number;
  expires: string;
}

export interface NoticeTemplate {
  id: string;
  channel: NoticeChannel;
  audience: Audience;
  name: string;
  title: string;
  body: string;
  enabled: boolean;
}

export interface OutboxItem {
  id: string;
  channel: NoticeChannel;
  audience: Audience;
  title: string;
  body: string;
  status: "queued";
  at: string;
}

export interface DistanceBand {
  id: string;
  label: string;
  upToKm: number | null;
  perKm: number;
}

export interface ClassRate {
  id: RideClassId;
  label: string;
  multiplier: number;
}

export type DistanceMode = "flat" | "banded";

export interface OpsPolicy {
  maxStops: number;
  minorDetourMeters: number;
  moderateDetourMeters: number;
  freeWaitMinutes: number;
  waitWarningMinutes: number;
  waitGraceMinutes: number;
  waitAppliesToPickup: boolean;
  waitAppliesToStops: boolean;
  arrivalGeofenceMeters: number;
  trafficCompMinDelayMinutes: number;
  trafficCompPerMinute: number;
  trafficCompMaxPerTrip: number;
  trafficCompClassIds: string[];
  trafficCompCities: string[];
  chargePassengerForTraffic: boolean;
}

export interface Pricing {
  /** B — base fare */
  baseFare: number;
  /** Rd — flat ₦/km when distanceMode is flat */
  perKm: number;
  /** Rt — ₦/minute */
  perMinute: number;
  minimumFare: number;
  /** Part of E */
  bookingFee: number;
  cancellationFee: number;
  waitPerMinute: number;
  commissionPercent: number;
  airportMultiplier: number;
  nightMultiplier: number;
  rainMultiplier: number;
  intercityPerKm: number;
  /** flat → D×perKm; banded → sum of band slices */
  distanceMode: DistanceMode;
  bands: DistanceBand[];
  classes: ClassRate[];
  ops?: OpsPolicy;
}

export interface AppConfig {
  abujaLive: boolean;
  lagosLive: boolean;
  ninRequired: boolean;
  stillPlay: boolean;
  supportEmail: string;
  supportPhone: string;
  /** Where drivers send subscription bank transfers. Narration must be their RRD code. */
  subscriptionBankName?: string;
  subscriptionAccountName?: string;
  subscriptionAccountNumber?: string;
  searchRadiusKm: number;
  offerWindowSec: number;
  driver: {
    minVersion: string;
    documentsRequired: boolean;
    destinationFilter: boolean;
    demandMap: boolean;
    maxOnlineHours: number;
  };
  customer: {
    minVersion: string;
    yourPrice: boolean;
    maxStops: number;
    shareTrip: boolean;
    sos: boolean;
    quietRide: boolean;
    scheduleAheadHours: number;
  };
}

export interface Activity {
  id: string;
  at: string;
  text: string;
}

export type ChatParty = "driver" | "customer";
export type ChatStatus = "waiting" | "open" | "closed";

export interface ChatMessage {
  id: string;
  from: "party" | "staff";
  author: string;
  body: string;
  at: string;
}

export interface ChatThread {
  id: string;
  party: ChatParty;
  partyId: string;
  subject: string;
  status: ChatStatus;
  city: CityId;
  updatedAt: string;
  messages: ChatMessage[];
}

export type StaffRole = "owner" | "operations" | "support" | "finance" | "viewer";

export interface Staff {
  id: string;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  status: "active" | "suspended";
}
