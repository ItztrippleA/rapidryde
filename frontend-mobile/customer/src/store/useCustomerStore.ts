import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Place } from "../lib/places";
import { uid } from "../lib/format";
import { clampFare, classById, type ClassId } from "../lib/fare";
import type { Pin } from "../lib/geo";
import { api, hasApi } from "../lib/api";
import { customerDummy } from "../lib/dummy";
import { resolveCustomerCode } from "../lib/publicCode";

/** Prevent overlapping /support/me polls from stacking network errors. */
let supportSyncInFlight = false;

export type PaymentMethod = "cash" | "wallet" | "card";
export type TripStage =
  | "searching"
  | "scheduled"
  | "assigned"
  | "to_pickup"
  | "arrived"
  | "on_trip"
  | "completed"
  | "cancelled"
  | "timeout"
  | "no_drivers"
  | "offline";

export type DriverCard = {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  colour: string;
  plate: string;
  fare: number;
  sample: boolean;
  latitude: number;
  longitude: number;
  /** Profile photo URL from the ride service. Empty until one is sent. */
  photo?: string;
  /** Driver phone from the ride service. Empty until one is sent. */
  phone?: string;
  /** True when the driver sent a fare bid (not just nearby). */
  bid?: boolean;
  fareTalk?: "agreed" | "waiting" | "counter";
  classId?: string;
  classLabel?: string;
};

export type CustomerTrip = {
  id: string;
  pickup: Place;
  dropoff: Place;
  stops: Place[];
  classId: ClassId;
  classLabel: string;
  fare: number;
  quote: number;
  payment: PaymentMethod;
  fareTalk?: "agreed" | "waiting" | "counter";
  counterFare?: number;
  stage: TripStage;
  driver: DriverCard | null;
  sample: boolean;
  scheduledAt: number | null;
  startedAt: number;
  endedAt: number;
  rating: number;
  review: string;
  km: number;
  minutes: number;
  issue: string;
  /** True when this booking is an Along shared seat. */
  along?: boolean;
  /** Open Along car the rider joined, if any. */
  poolId?: string;
  seatsTaken?: number;
  seatsTotal?: number;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
};
export type ChatLine = {
  id: string;
  from: "customer" | "desk" | "driver";
  text: string;
  at: number;
};
export type Ledger = {
  id: string;
  label: string;
  amount: number;
  at: number;
  pending: boolean;
};

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  referral: string;
  photo: string;
};

export type IdentityStatus = "missing" | "pending" | "approved" | "rejected";

export type CustomerIdentity = {
  maskedNin: string;
  selfieUri: string;
  slipUri: string;
  status: IdentityStatus;
  failureReason: string;
  consented: boolean;
  matchConfidence?: number;
};

type Booking = {
  pickup: Place | null;
  dropoff: Place | null;
  stops: Place[];
  classId: ClassId;
  payment: PaymentMethod;
  promo: string;
  fare: number;
  quote: number;
  scheduledAt: number | null;
  /** Selected open Along car, or empty when requesting a new shared ride. */
  poolId: string;
  /** Passenger seat index in the Along cabin. -1 until chosen. */
  seatIndex: number;
};

type CustomerState = {
  hydrated: boolean;
  onboarded: boolean;
  hasSession: boolean;
  mode: "light" | "dark";
  phone: string;
  /** Public account id, e.g. RR-2342 */
  publicCode: string;
  profile: Profile;
  /** Dojah NIN + face verification (signup). */
  identity: CustomerIdentity;
  wallet: number;
  pending: number;
  ledger: Ledger[];
  home: Place | null;
  work: Place | null;
  saved: Place[];
  recent: Place[];
  booking: Booking;
  trip: CustomerTrip | null;
  trips: CustomerTrip[];
  scheduled: CustomerTrip[];
  notices: Notice[];
  support: ChatLine[];
  coords: Pin | null;
  push: "off" | "local" | "onesignal";
  analytics: "off" | "posthog";
  confirming: boolean;
  setHydrated: (value: boolean) => void;
  setOnboarded: () => void;
  replayOnboarding: () => void;
  setMode: (mode: "light" | "dark") => void;
  setHasSession: (value: boolean) => void;
  setShell: (patch: {
    push?: CustomerState["push"];
    analytics?: CustomerState["analytics"];
  }) => void;
  setCoords: (coords: Pin | null) => void;
  completeAuth: (
    phone: string,
    profile?: Partial<Profile>,
    options?: { publicCode?: string },
  ) => void;
  setPublicCode: (publicCode: string) => void;
  saveIdentity: (identity: CustomerIdentity) => void;
  signOut: () => void;
  deleteLocal: () => void;
  saveProfile: (profile: Partial<Profile>) => void;
  rememberPlace: (place: Place) => void;
  saveHome: (place: Place | null) => void;
  saveWork: (place: Place | null) => void;
  addSaved: (place: Place) => void;
  removeSaved: (id: string) => void;
  setPickup: (place: Place | null) => void;
  setDropoff: (place: Place | null) => void;
  /** Wipe class, stops, Along, promo, fare, and schedule. Keeps pickup/dropoff/payment. */
  clearBookingFilters: () => void;
  /** Start a fresh booking for a destination. Clears filters and keeps current pickup when set. */
  startTrip: (dropoff: Place, pickup?: Place | null) => void;
  swapEnds: () => void;
  addStop: (place: Place) => boolean;
  removeStop: (id: string) => void;
  moveStop: (id: string, direction: -1 | 1) => void;
  setClass: (classId: ClassId, quote: number) => void;
  setPool: (poolId: string, fare?: number, quote?: number) => void;
  setSeat: (seatIndex: number) => void;
  setFare: (fare: number) => void;
  setPayment: (payment: PaymentMethod) => void;
  setPromo: (promo: string) => void;
  setSchedule: (at: number | null) => void;
  beginConfirm: () => void;
  endConfirm: () => void;
  openTrip: (trip: CustomerTrip) => void;
  patchTrip: (patch: Partial<CustomerTrip>) => void;
  finishTrip: (
    stage: "completed" | "cancelled" | "timeout" | "no_drivers",
  ) => void;
  saveReview: (id: string, rating: number, review: string) => void;
  saveScheduled: (trip: CustomerTrip) => void;
  updateScheduled: (id: string, patch: Partial<CustomerTrip>) => void;
  cancelScheduled: (id: string) => void;
  addNotice: (title: string, body: string) => void;
  markNotices: () => void;
  sendSupport: (text: string) => void;
  syncSupport: () => void;
  applyWallet: (balance: number, row?: Ledger) => void;
};

const emptyBooking = (): Booking => ({
  pickup: null,
  dropoff: null,
  stops: [],
  classId: "ryde",
  payment: "cash",
  promo: "",
  fare: 0,
  quote: 0,
  scheduledAt: null,
  poolId: "",
  seatIndex: -1,
});

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Place;
  return Boolean(
    typeof place.id === "string" &&
    place.id &&
    typeof place.label === "string" &&
    place.label &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude),
  );
}

function cleanPlaces(value: unknown): Place[] {
  return Array.isArray(value) ? value.filter(isPlace) : [];
}

function normalizeBooking(booking?: Partial<Booking> | null): Booking {
  const base = emptyBooking();
  if (!booking) return base;
  const classId = pricingClassId(booking.classId);
  return {
    ...base,
    ...booking,
    pickup: isPlace(booking.pickup) ? booking.pickup : null,
    dropoff: isPlace(booking.dropoff) ? booking.dropoff : null,
    stops: cleanPlaces(booking.stops),
    classId,
    poolId:
      classId === "along" && typeof booking.poolId === "string"
        ? booking.poolId
        : "",
    seatIndex:
      classId === "along" && Number.isFinite(booking.seatIndex)
        ? Number(booking.seatIndex)
        : -1,
    promo: typeof booking.promo === "string" ? booking.promo : "",
    fare: Number.isFinite(booking.fare) ? Number(booking.fare) : 0,
    quote: Number.isFinite(booking.quote) ? Number(booking.quote) : 0,
    scheduledAt:
      typeof booking.scheduledAt === "number" ? booking.scheduledAt : null,
    payment:
      booking.payment === "wallet" ||
      booking.payment === "card" ||
      booking.payment === "cash"
        ? booking.payment
        : "cash",
  };
}

function pricingClassId(value: unknown): ClassId {
  const id = typeof value === "string" ? value : "";
  return (classById(id).id as ClassId) || "ryde";
}

function withClearedFilters(booking: Booking): Booking {
  return {
    ...booking,
    stops: [],
    classId: "ryde",
    poolId: "",
    seatIndex: -1,
    promo: "",
    fare: 0,
    quote: 0,
    scheduledAt: null,
  };
}

const emptyProfile = (): Profile => ({
  firstName: "",
  lastName: "",
  email: "",
  referral: "",
  photo: "",
});

const emptyIdentity = (): CustomerIdentity => ({
  maskedNin: "",
  selfieUri: "",
  slipUri: "",
  status: "missing",
  failureReason: "",
  consented: false,
});

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      hasSession: false,
      mode: "light",
      phone: "",
      publicCode: "",
      profile: emptyProfile(),
      identity: emptyIdentity(),
      wallet: 0,
      pending: 0,
      ledger: [],
      home: null,
      work: null,
      saved: [],
      recent: [],
      booking: emptyBooking(),
      trip: null,
      trips: [],
      scheduled: [],
      notices: [],
      support: [
        {
          id: "welcome",
          from: "desk",
          text: "Rapyd Ryd support. Documents, trips, and wallet questions land here.",
          at: Date.now(),
        },
      ],
      coords: null,
      push: "off",
      analytics: "off",
      confirming: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setOnboarded: () => set({ onboarded: true }),
      replayOnboarding: () => set({ onboarded: false }),
      setMode: (mode) => set({ mode }),
      setHasSession: (hasSession) => set({ hasSession }),
      setShell: (patch) => set(patch),
      setCoords: (coords) => set({ coords }),
      completeAuth: (phone, profile, options) => {
        set({
          phone,
          publicCode: resolveCustomerCode(
            options?.publicCode ?? get().publicCode,
            phone,
          ),
          hasSession: true,
          profile: { ...get().profile, ...profile },
        });
        // Fresh session: default pickup to GPS; rider can change it later.
        void import("../lib/seedPickup").then(({ seedPickupFromGps }) =>
          seedPickupFromGps({ force: true }),
        );
      },
      setPublicCode: (publicCode) =>
        set({ publicCode: resolveCustomerCode(publicCode, get().phone) }),
      saveIdentity: (identity) => set({ identity }),
      signOut: () => {
        const mode = get().mode;
        const onboarded = get().onboarded;
        set({
          hasSession: false,
          onboarded,
          mode,
          phone: "",
          publicCode: "",
          profile: emptyProfile(),
          identity: emptyIdentity(),
          wallet: 0,
          pending: 0,
          ledger: [],
          home: null,
          work: null,
          saved: [],
          recent: [],
          booking: emptyBooking(),
          trip: null,
          trips: [],
          scheduled: [],
          notices: [],
          support: [
            {
              id: "welcome",
              from: "desk",
              text: "Rapyd Ryd support. Documents, trips, and wallet questions land here.",
              at: Date.now(),
            },
          ],
          confirming: false,
          coords: null,
        });
        void Promise.resolve(useCustomerStore.persist.clearStorage?.()).catch(
          () => undefined,
        );
      },
      deleteLocal: () => {
        set({
          hasSession: false,
          onboarded: false,
          phone: "",
          publicCode: "",
          profile: emptyProfile(),
          identity: emptyIdentity(),
          wallet: 0,
          pending: 0,
          ledger: [],
          home: null,
          work: null,
          saved: [],
          recent: [],
          booking: emptyBooking(),
          trip: null,
          trips: [],
          scheduled: [],
          notices: [],
          support: [
            {
              id: "welcome",
              from: "desk",
              text: "Rapyd Ryd support. Documents, trips, and wallet questions land here.",
              at: Date.now(),
            },
          ],
          confirming: false,
          coords: null,
        });
        void Promise.resolve(useCustomerStore.persist.clearStorage?.()).catch(
          () => undefined,
        );
      },
      saveProfile: (profile) =>
        set({ profile: { ...get().profile, ...profile } }),
      rememberPlace: (place) => {
        const recent = [
          place,
          ...get().recent.filter((item) => item.id !== place.id),
        ].slice(0, 8);
        set({ recent });
        void import("../lib/places").then(
          async ({ isGenericPlaceLabel, resolvePlaceLabel }) => {
            if (!isGenericPlaceLabel(place.label)) return;
            const next = await resolvePlaceLabel(place);
            if (isGenericPlaceLabel(next.label) || next.label === place.label)
              return;
            set({
              recent: get().recent.map((item) =>
                item.id === place.id ||
                (item.latitude === place.latitude &&
                  item.longitude === place.longitude)
                  ? { ...item, label: next.label }
                  : item,
              ),
            });
          },
        );
      },
      saveHome: (home) => set({ home }),
      saveWork: (work) => set({ work }),
      addSaved: (place) =>
        set({
          saved: [
            place,
            ...get().saved.filter((item) => item.label !== place.label),
          ].slice(0, 12),
        }),
      removeSaved: (id) =>
        set({ saved: get().saved.filter((item) => item.id !== id) }),
      setPickup: (pickup) =>
        set({
          booking: {
            ...normalizeBooking(get().booking),
            pickup: isPlace(pickup) ? pickup : null,
          },
        }),
      setDropoff: (dropoff) => {
        const booking = normalizeBooking(get().booking);
        const next = isPlace(dropoff) ? dropoff : null;
        const samePlace =
          !!next &&
          !!booking.dropoff &&
          next.id === booking.dropoff.id &&
          Math.abs(next.latitude - booking.dropoff.latitude) < 1e-5 &&
          Math.abs(next.longitude - booking.dropoff.longitude) < 1e-5;
        set({
          booking: {
            ...booking,
            dropoff: next,
            /** New destination starts a new trip plan — drop mid-stops from the previous one. */
            stops: samePlace ? booking.stops : [],
          },
        });
      },
      clearBookingFilters: () => {
        const booking = normalizeBooking(get().booking);
        set({ booking: withClearedFilters(booking) });
      },
      startTrip: (dropoff, pickup) => {
        const booking = normalizeBooking(get().booking);
        const coords = get().coords;
        const nextPickup = isPlace(pickup)
          ? pickup
          : isPlace(booking.pickup)
            ? booking.pickup
            : coords
              ? {
                  id: "here",
                  label: "Current location",
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }
              : null;
        set({
          booking: {
            ...withClearedFilters(booking),
            pickup: nextPickup,
            dropoff: isPlace(dropoff) ? dropoff : null,
            stops: [],
          },
        });
        if (!nextPickup) {
          void import("../lib/seedPickup").then(({ seedPickupFromGps }) =>
            seedPickupFromGps(),
          );
        }
      },
      swapEnds: () => {
        const booking = normalizeBooking(get().booking);
        set({
          booking: {
            ...booking,
            pickup: booking.dropoff,
            dropoff: booking.pickup,
          },
        });
      },
      addStop: (place) => {
        const booking = normalizeBooking(get().booking);
        if (!isPlace(place) || booking.stops.length >= 2) return false;
        set({ booking: { ...booking, stops: [...booking.stops, place] } });
        return true;
      },
      removeStop: (id) => {
        const booking = normalizeBooking(get().booking);
        set({
          booking: {
            ...booking,
            stops: booking.stops.filter((item) => item.id !== id),
          },
        });
      },
      moveStop: (id, direction) => {
        const booking = normalizeBooking(get().booking);
        const stops = [...booking.stops];
        const index = stops.findIndex((item) => item.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= stops.length) return;
        const [row] = stops.splice(index, 1);
        if (!row) return;
        stops.splice(next, 0, row);
        set({ booking: { ...booking, stops } });
      },
      setClass: (classId, quote) => {
        const fare = clampFare(quote, quote);
        const booking = normalizeBooking(get().booking);
        set({
          booking: {
            ...booking,
            classId,
            quote,
            fare,
            poolId: classId === "along" ? booking.poolId : "",
            seatIndex: classId === "along" ? booking.seatIndex : -1,
          },
        });
      },
      setPool: (poolId, fare, quote) => {
        const booking = normalizeBooking(get().booking);
        const nextQuote = quote ?? booking.quote;
        const nextFare = fare ?? booking.fare;
        set({
          booking: {
            ...booking,
            classId: "along",
            poolId,
            quote: nextQuote,
            fare: nextFare,
            seatIndex: poolId === booking.poolId ? booking.seatIndex : -1,
          },
        });
      },
      setSeat: (seatIndex) => {
        const booking = normalizeBooking(get().booking);
        set({ booking: { ...booking, classId: "along", seatIndex } });
      },
      setFare: (fare) => {
        const booking = normalizeBooking(get().booking);
        set({
          booking: {
            ...booking,
            fare: booking.quote ? clampFare(booking.quote, fare) : fare,
          },
        });
      },
      setPayment: (payment) =>
        set({ booking: { ...normalizeBooking(get().booking), payment } }),
      setPromo: (promo) =>
        set({ booking: { ...normalizeBooking(get().booking), promo } }),
      setSchedule: (scheduledAt) =>
        set({ booking: { ...normalizeBooking(get().booking), scheduledAt } }),
      beginConfirm: () => set({ confirming: true }),
      endConfirm: () => set({ confirming: false }),
      openTrip: (trip) => set({ trip, confirming: false }),
      patchTrip: (patch) => {
        const trip = get().trip;
        if (!trip) return;
        set({ trip: { ...trip, ...patch } });
      },
      finishTrip: (stage) => {
        const trip = get().trip;
        if (!trip) return;
        const closed = { ...trip, stage, endedAt: Date.now() };
        const recent =
          stage === "completed"
            ? [
                trip.dropoff,
                ...get().recent.filter(
                  (item) => item.label !== trip.dropoff.label,
                ),
              ].slice(0, 12)
            : get().recent;
        const booking = normalizeBooking(get().booking);
        set({
          trip: null,
          trips: [
            closed,
            ...get().trips.filter((item) => item.id !== closed.id),
          ],
          recent,
          confirming: false,
          booking: {
            ...withClearedFilters(booking),
            dropoff: null,
          },
        });
      },
      saveReview: (id, rating, review) => {
        const apply = (item: CustomerTrip) =>
          item.id === id ? { ...item, rating, review: review.trim() } : item;
        const live = get().trip;
        set({
          trips: get().trips.map(apply),
          trip: live && live.id === id ? apply(live) : live,
        });
      },
      saveScheduled: (trip) =>
        set({
          scheduled: [
            trip,
            ...get().scheduled.filter((item) => item.id !== trip.id),
          ],
          confirming: false,
        }),
      updateScheduled: (id, patch) =>
        set({
          scheduled: get().scheduled.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }),
      cancelScheduled: (id) =>
        set({
          scheduled: get().scheduled.map((item) =>
            item.id === id
              ? { ...item, stage: "cancelled", endedAt: Date.now() }
              : item,
          ),
        }),
      addNotice: (title, body) =>
        set({
          notices: [
            { id: uid("n"), title, body, at: Date.now(), read: false },
            ...get().notices,
          ].slice(0, 40),
        }),
      markNotices: () =>
        set({
          notices: get().notices.map((item) => ({ ...item, read: true })),
        }),
      sendSupport: (text) => {
        const line: ChatLine = {
          id: uid("m"),
          from: "customer",
          text: text.trim(),
          at: Date.now(),
        };
        if (!line.text) return;
        set({ support: [...get().support, line] });
        if (!hasApi()) {
          setTimeout(() => {
            set({
              support: [
                ...get().support,
                {
                  id: uid("m"),
                  from: "desk",
                  text: "Got it. We'll look at this.",
                  at: Date.now(),
                },
              ],
            });
          }, 600);
          return;
        }
        void api<{
          messages?: Array<{
            id: string;
            from: string;
            body: string;
            at: number;
          }>;
        }>("/support/messages", {
          method: "POST",
          body: JSON.stringify({ text: line.text, kind: "text" }),
        })
          .then((thread) => {
            if (!Array.isArray(thread?.messages)) return;
            set({
              support: thread.messages.map((message) => ({
                id: message.id,
                from: message.from === "staff" ? "desk" : "customer",
                text: message.body,
                at: message.at,
              })),
            });
          })
          .catch(() => undefined);
      },
      syncSupport: () => {
        if (!hasApi()) return;
        if (supportSyncInFlight) return;
        supportSyncInFlight = true;
        void api<{
          messages?: Array<{
            id: string;
            from: string;
            body: string;
            at: number;
          }>;
        }>("/support/me")
          .then((thread) => {
            if (!thread || !Array.isArray(thread.messages)) return;
            const next = thread.messages.map((message) => ({
              id: message.id,
              from: (message.from === "staff"
                ? "desk"
                : "customer") as ChatLine["from"],
              text: message.body,
              at: message.at,
            }));
            const prev = get().support;
            if (
              prev.length === next.length &&
              prev.every(
                (line, index) =>
                  line.id === next[index]?.id &&
                  line.text === next[index]?.text,
              )
            ) {
              return;
            }
            set({ support: next });
          })
          .catch(() => undefined)
          .finally(() => {
            supportSyncInFlight = false;
          });
      },
      applyWallet: (balance, row) =>
        set({
          wallet: balance,
          ledger: row ? [row, ...get().ledger] : get().ledger,
        }),
    }),
    {
      name: "rapyd-rider",
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        const current = state ?? useCustomerStore.getState();
        const booking = normalizeBooking(current.booking);
        const trips = Array.isArray(current.trips) ? current.trips : [];
        const recent = Array.isArray(current.recent) ? current.recent : [];
        const scheduled = Array.isArray(current.scheduled)
          ? current.scheduled
          : [];
        const publicCode = resolveCustomerCode(
          current.publicCode,
          current.phone || "customer",
        );
        const identity = {
          ...emptyIdentity(),
          ...(current.identity || {}),
        };
        if (hasApi() || trips.length > 0 || current.wallet > 0) {
          useCustomerStore.setState({
            booking,
            trips,
            recent,
            scheduled,
            publicCode,
            identity,
          });
          return;
        }
        const seeded = customerDummy();
        useCustomerStore.setState({
          ...seeded,
          booking,
          publicCode,
          identity,
          home: current.home ?? seeded.home,
          work: current.work ?? seeded.work,
          recent: recent.length ? recent : seeded.recent,
          scheduled: scheduled.length ? scheduled : seeded.scheduled,
        });
      },
      partialize: (state) => ({
        onboarded: state.onboarded,
        mode: state.mode,
        phone: state.phone,
        publicCode: state.publicCode,
        profile: state.profile,
        identity: state.identity,
        wallet: state.wallet,
        pending: state.pending,
        ledger: state.ledger,
        home: state.home,
        work: state.work,
        saved: state.saved,
        recent: state.recent,
        booking: state.booking,
        trip: state.trip,
        trips: state.trips,
        scheduled: state.scheduled,
        notices: state.notices,
        support: state.support,
      }),
    },
  ),
);

export function displayName(profile: Profile) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return name || "Rider";
}

export function blankTrip(
  partial: Omit<
    CustomerTrip,
    "rating" | "review" | "endedAt" | "startedAt" | "issue"
  > & { startedAt?: number },
): CustomerTrip {
  return {
    ...partial,
    startedAt: partial.startedAt ?? Date.now(),
    endedAt: 0,
    rating: 0,
    review: "",
    issue: "",
    classLabel: partial.classLabel || classById(partial.classId).label,
  };
}
