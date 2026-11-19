/** Full ride session kept for ops, receipts, disputes, and relaunch. */

export type RideStatus =
  | 'searching'
  | 'assigned'
  | 'to_pickup'
  | 'arrived'
  | 'on_trip'
  | 'completed'
  | 'cancelled'
  | 'timeout'
  | 'no_drivers';

export type PaymentMethod = 'cash' | 'wallet' | 'card' | 'transfer';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  at?: number;
  heading?: number;
  accuracyM?: number;
};

export type RideParty = {
  id: string;
  name: string;
  phone: string;
  rating?: number;
  photo?: string;
  vehicle?: string;
  plate?: string;
  colour?: string;
};

export type RideStop = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type StatusEvent = {
  status: RideStatus;
  at: number;
  by?: 'customer' | 'driver' | 'system' | 'admin';
  note?: string;
};

export type FareEvent = {
  fare: number;
  quoted: number;
  at: number;
  by: 'customer' | 'driver' | 'system' | 'admin';
  note?: string;
};

export type LocationPing = {
  role: 'driver' | 'customer';
  latitude: number;
  longitude: number;
  at: number;
  heading?: number;
};

export type ChatEvent = {
  id: string;
  from: 'driver' | 'customer' | 'desk';
  kind: 'text' | 'voice';
  text: string;
  audioUrl?: string;
  durationMs?: number;
  at: number;
};

export type RideSession = {
  id: string;
  /** City desk */
  city: string;
  classId: string;
  classLabel: string;
  status: RideStatus;
  payment: PaymentMethod;

  customerId: string;
  customer: RideParty;
  driverId: string | null;
  driver: RideParty | null;

  pickup: RideStop;
  dropoff: RideStop;
  stops: RideStop[];

  /** Planned route metrics at request time */
  plannedKm: number;
  plannedMinutes: number;
  /** Actuals filled as the trip progresses */
  actualKm: number | null;
  actualMinutes: number | null;

  quoted: number;
  fare: number;
  earnings: number;
  commissionPercent: number;
  promoCode: string;

  along: boolean;
  poolId: string;
  seatIndex: number;

  /** Latest known positions */
  driverLocation: GeoPoint | null;
  customerLocation: GeoPoint | null;

  /** Append-only history */
  statusHistory: StatusEvent[];
  fareHistory: FareEvent[];
  locationTrail: LocationPing[];
  chat: ChatEvent[];

  note: string;
  scheduledAt: number | null;
  startedAt: number;
  assignedAt: number | null;
  arrivedAt: number | null;
  onboardAt: number | null;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export function emptyParty(id: string, name = '', phone = ''): RideParty {
  return { id, name, phone };
}

export function normalizeRide(
  raw: Partial<RideSession> & {
    pickup?: string | RideStop;
    dropoff?: string | RideStop;
  },
): RideSession {
  const now = Date.now();
  const pickup =
    typeof raw.pickup === 'string'
      ? { id: 'pickup', label: raw.pickup, latitude: 0, longitude: 0 }
      : raw.pickup || { id: 'pickup', label: '', latitude: 0, longitude: 0 };
  const dropoff =
    typeof raw.dropoff === 'string'
      ? { id: 'dropoff', label: raw.dropoff, latitude: 0, longitude: 0 }
      : raw.dropoff || { id: 'dropoff', label: '', latitude: 0, longitude: 0 };

  const legacy = raw as Partial<RideSession> & {
    km?: number;
    minutes?: number;
  };
  return {
    id: raw.id || `ride_${now.toString(36)}`,
    city: raw.city || 'abuja',
    classId: raw.classId || 'ryde',
    classLabel: raw.classLabel || 'Ryde',
    status: (raw.status as RideStatus) || 'searching',
    payment: raw.payment || 'cash',
    customerId: raw.customerId || '',
    customer: raw.customer || emptyParty(raw.customerId || ''),
    driverId: raw.driverId ?? null,
    driver: raw.driver ?? null,
    pickup,
    dropoff,
    stops: Array.isArray(raw.stops) ? raw.stops : [],
    plannedKm: raw.plannedKm ?? legacy.km ?? 0,
    plannedMinutes: raw.plannedMinutes ?? legacy.minutes ?? 0,
    actualKm: raw.actualKm ?? null,
    actualMinutes: raw.actualMinutes ?? null,
    quoted: raw.quoted ?? 0,
    fare: raw.fare ?? 0,
    earnings: raw.earnings ?? 0,
    commissionPercent: raw.commissionPercent ?? 10,
    promoCode: raw.promoCode || '',
    along: Boolean(raw.along),
    poolId: raw.poolId || '',
    seatIndex: Number.isFinite(raw.seatIndex) ? Number(raw.seatIndex) : -1,
    driverLocation: raw.driverLocation ?? null,
    customerLocation: raw.customerLocation ?? null,
    statusHistory: Array.isArray(raw.statusHistory)
      ? raw.statusHistory
      : [
          {
            status: (raw.status as RideStatus) || 'searching',
            at: raw.createdAt || now,
            by: 'system',
          },
        ],
    fareHistory: Array.isArray(raw.fareHistory) ? raw.fareHistory : [],
    locationTrail: Array.isArray(raw.locationTrail) ? raw.locationTrail : [],
    chat: Array.isArray(raw.chat) ? raw.chat : [],
    note: raw.note || '',
    scheduledAt: raw.scheduledAt ?? null,
    startedAt: raw.startedAt || raw.createdAt || now,
    assignedAt: raw.assignedAt ?? null,
    arrivedAt: raw.arrivedAt ?? null,
    onboardAt: raw.onboardAt ?? null,
    endedAt: raw.endedAt ?? null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}
