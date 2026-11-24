import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ui/Button";
import { CityMap } from "../components/map/CityMap";
import { usePalette } from "../theme/Theme";
import { blankTrip, useCustomerStore } from "../store/useCustomerStore";
import { ALONG_SEATS, classById, pricing, routeKm, SEARCH_RADIUS_KM } from "../lib/fare";
import { naira, uid, whenLabel } from "../lib/format";
import { api, hasApi, hasRideService } from "../lib/api";
import { availablePools, poolById, poolStops, seatsLeft } from "../lib/pool";
import { firstOpenSeat, seatLabel } from "../lib/seats";
import { remindPickup } from "../services/device";
import { CabinPicker, cabinColour } from "../components/ride/CabinPicker";
import { ClassCarArt, classVehicleLabel } from "../components/ride/ClassCarArt";
import { estimateRoute, etaLabel, type RouteEstimate } from "../lib/routing";
import { useNearbyDrivers } from "../hooks/useNearbyDrivers";

export default function Confirm() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const mapBand = Math.max(260, Math.round(screenH * 0.34));
  const booking = useCustomerStore((s) => s.booking);
  const coords = useCustomerStore((s) => s.coords);
  const wallet = useCustomerStore((s) => s.wallet);
  const hub = booking.pickup || coords || { latitude: 9.0765, longitude: 7.3986 };
  const cars = useNearbyDrivers(hub);
  const confirming = useCustomerStore((s) => s.confirming);
  const beginConfirm = useCustomerStore((s) => s.beginConfirm);
  const endConfirm = useCustomerStore((s) => s.endConfirm);
  const openTrip = useCustomerStore((s) => s.openTrip);
  const saveScheduled = useCustomerStore((s) => s.saveScheduled);
  const setSchedule = useCustomerStore((s) => s.setSchedule);
  const addNotice = useCustomerStore((s) => s.addNotice);
  const ride = classById(booking.classId);
  const along = booking.classId === "along";
  const pools = availablePools(booking.pickup, booking.dropoff);
  const selectedPool = pools.find((car) => car.id === booking.poolId) ?? (booking.poolId ? poolById(booking.poolId) : null);
  const blocked = booking.payment === "card" || (booking.payment === "wallet" && wallet < booking.fare);
  const stops = booking.stops ?? [];
  const mapStops = selectedPool ? poolStops(selectedPool, booking.pickup, booking.dropoff) : stops;
  const fallbackKm = booking.pickup && booking.dropoff ? routeKm(booking.pickup, booking.dropoff, stops) : 0;
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const km = route?.km || fallbackKm;
  const minutes = route?.minutes || Math.max(5, Math.round((km / 25) * 60));
  const payLabel = booking.payment === "cash" ? "Cash" : booking.payment === "wallet" ? "Wallet" : "Card";
  const payIcon = booking.payment === "cash" ? "cash-outline" : booking.payment === "wallet" ? "wallet-outline" : "card-outline";
  const short = (label?: string) => (label || "Not set").split(",")[0];
  const taken = selectedPool?.taken ?? 0;
  const seats = selectedPool?.seats ?? ALONG_SEATS;
  const seatIndex = booking.seatIndex >= 0 ? booking.seatIndex : firstOpenSeat(taken);

  useEffect(() => {
    if (!booking.pickup || !booking.dropoff) return;
    let alive = true;
    void estimateRoute(booking.pickup, booking.dropoff, stops).then((estimate) => {
      if (alive) setRoute(estimate);
    });
    return () => {
      alive = false;
    };
  }, [booking.dropoff, booking.pickup, stops]);

  async function confirm() {
    if (confirming || !booking.pickup || !booking.dropoff) return;
    beginConfirm();
    const joining = along && selectedPool && booking.poolId;
    let rideId = uid("ride");
    let sample = !hasApi();
    if (hasApi() && !booking.scheduledAt) {
      try {
        const body = await api<{ ride: { id: string } }>("/rides", {
          method: "POST",
          body: JSON.stringify({
            pickup: booking.pickup.label,
            dropoff: booking.dropoff.label,
            pickupLat: booking.pickup.latitude,
            pickupLng: booking.pickup.longitude,
            dropLat: booking.dropoff.latitude,
            dropLng: booking.dropoff.longitude,
            stops: stops.map((stop) => ({
              id: stop.id,
              label: stop.label,
              latitude: stop.latitude,
              longitude: stop.longitude,
            })),
            km,
            minutes,
            classId: booking.classId,
            fareOverride: booking.fare,
            payment: booking.payment,
            along,
            poolId: booking.poolId || undefined,
            joinPoolId: joining ? booking.poolId : undefined,
            seatIndex: along ? seatIndex : undefined,
            city: "abuja",
            radiusKm: SEARCH_RADIUS_KM,
          }),
        });
        if (body?.ride?.id) {
          rideId = body.ride.id;
          sample = false;
        }
      } catch {
        endConfirm();
        addNotice("Could not start ride", "Check your connection and try again.");
        return;
      }
    }
    const trip = blankTrip({
      id: rideId,
      pickup: booking.pickup,
      dropoff: booking.dropoff,
      stops: joining ? poolStops(selectedPool, booking.pickup, booking.dropoff) : stops,
      classId: booking.classId,
      classLabel: ride.label,
      fare: booking.fare,
      quote: booking.quote,
      payment: booking.payment,
      stage: booking.scheduledAt ? "scheduled" : joining ? "assigned" : "searching",
      driver: joining
        ? {
            id: selectedPool.id,
            name: selectedPool.name,
            rating: selectedPool.rating,
            vehicle: selectedPool.vehicle,
            colour: selectedPool.colour,
            plate: selectedPool.plate,
            fare: booking.fare,
            sample: !hasRideService(),
            latitude: selectedPool.latitude,
            longitude: selectedPool.longitude,
          }
        : null,
      sample,
      scheduledAt: booking.scheduledAt,
      km,
      minutes: joining ? selectedPool.etaMin : minutes,
      along,
      poolId: booking.poolId || undefined,
      seatsTaken: joining ? taken + 1 : along ? 1 : undefined,
      seatsTotal: along ? seats : undefined,
      fareTalk: joining ? "agreed" : undefined,
    });
    if (booking.scheduledAt) {
      saveScheduled({ ...trip, stage: "scheduled" });
      addNotice("Ride scheduled", `${whenLabel(booking.scheduledAt)} · ${booking.pickup.label}.`);
      void remindPickup(booking.scheduledAt, `${booking.pickup.label} to ${booking.dropoff.label}`);
      setSchedule(null);
      router.replace("/trips");
      return;
    }
    openTrip(trip);
    if (joining) {
      addNotice("Along seat booked", `${selectedPool.name} · ${short(booking.pickup.label)} to ${short(booking.dropoff.label)}.`);
      router.replace("/trip");
      return;
    }
    addNotice(along ? "Finding an Along car" : "Finding a driver", `${booking.pickup.label} to ${booking.dropoff.label}`);
    router.replace("/matching");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ height: mapBand }}>
        <CityMap pickup={booking.pickup} dropoff={booking.dropoff} stops={mapStops} cars={cars} contentBottomPad={0} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => { endConfirm(); router.back(); }}
          style={{ position: "absolute", top: insets.top + 8, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(420)} style={{ flex: 1, marginTop: -28, backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 4, backgroundColor: palette.line, marginTop: 10 }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 12, gap: 14 }}>
          <View>
            <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "800" }}>REVIEW RIDE</Text>
            <Text style={{ color: palette.ink, fontSize: 28, fontWeight: "800" }}>{km ? `${km.toFixed(1)} km` : "Your ride"}</Text>
          </View>

          <View style={{ backgroundColor: palette.paper, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 14 }}>
            <Stop kind="pickup" hint="Pickup" label={short(booking.pickup?.label)} />
            {stops.map((stop, index) => (
              <Stop key={stop.id || `stop-${index}`} kind="stop" hint={`Stop ${index + 1}`} label={short(stop.label)} />
            ))}
            <Stop kind="drop" hint="Destination" label={short(booking.dropoff?.label)} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: palette.accentSoft, borderWidth: 1.5, borderColor: palette.accent }}>
            <ClassCarArt classId={booking.classId} selected width={78} height={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 17 }}>{ride.label}</Text>
              <Text style={{ color: palette.muted }}>{classVehicleLabel(booking.classId)}</Text>
              <Text style={{ color: palette.muted }}>{booking.scheduledAt ? whenLabel(booking.scheduledAt) : along ? seatLabel(seatIndex) : "Pickup now"}</Text>
            </View>
            <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 22 }}>{naira(booking.fare)}</Text>
          </View>

          {along ? (
            <View style={{ backgroundColor: palette.paper, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 10, alignItems: "center" }}>
              <Text style={{ color: palette.ink, fontWeight: "800", alignSelf: "stretch" }}>
                {selectedPool ? `${selectedPool.name} · ${selectedPool.colour} ${selectedPool.vehicle}` : "New Along"}
              </Text>
              <CabinPicker
                compact
                taken={taken}
                selectedIndex={seatIndex}
                colour={cabinColour(selectedPool?.colour)}
              />
              <Text style={{ color: palette.muted, alignSelf: "stretch" }}>
                {seatLabel(seatIndex)} · {taken}/{seats} seated now · {Math.max(0, seatsLeft({ seats, taken }) - 1)} left after you
              </Text>
              <Text style={{ color: palette.ink, lineHeight: 20, alignSelf: "stretch" }}>
                Your {km.toFixed(1)} km sets your share of the corridor. More riders on the path lower what everyone pays.
              </Text>
              {selectedPool?.riders.map((rider, index) => (
                <Text key={rider.id} style={{ color: palette.muted, alignSelf: "stretch" }}>
                  {seatLabel(index)} · {rider.name} · {short(rider.pickup.label)} → {short(rider.dropoff.label)} · {naira(rider.fare)}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Fact icon={payIcon} label="Pay with" value={booking.payment === "wallet" ? `${payLabel} · ${naira(wallet)}` : payLabel} />
            <Fact icon="pricetag-outline" label={along ? "Your seat" : "Quote"} value={naira(booking.fare || booking.quote)} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Fact icon="navigate-outline" label="Distance" value={`${km.toFixed(1)} km`} />
            <Fact
              icon="time-outline"
              label="ETA"
              value={etaLabel(route) || `${minutes} min`}
            />
          </View>
          {route?.isTrafficHeavy ? (
            <Text style={{ color: "#C4482D", fontWeight: "700" }}>
              Heavy traffic · +{Math.max(1, Math.round(route.trafficDelaySec / 60))} min over normal
            </Text>
          ) : null}

          <Text style={{ color: palette.muted, lineHeight: 20 }}>
            Cancellation after a driver is assigned is {naira(pricing.cancellationFee)}.
          </Text>
          {blocked ? (
            <Text style={{ color: "#C4482D", fontWeight: "700" }}>
              {booking.payment === "card" ? "Choose cash or wallet for this trip." : "Wallet balance is below this fare."}
            </Text>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
          <Button
            label={booking.scheduledAt ? "Confirm scheduled ride" : along ? (booking.poolId ? "Book this Along seat" : "Start Along") : "Confirm ride"}
            onPress={confirm}
            loading={confirming}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function Stop({ kind, hint, label }: { kind: "pickup" | "stop" | "drop"; hint: string; label: string }) {
  const palette = usePalette();
  const color = kind === "pickup" ? "#8FB800" : kind === "stop" ? "#E2B657" : palette.accent;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: kind === "drop" ? 2 : 6, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.muted, fontSize: 11, fontWeight: "800" }}>{hint.toUpperCase()}</Text>
        <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={{ flex: 1, minHeight: 78, borderRadius: 16, padding: 12, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, justifyContent: "center", gap: 4 }}>
      <Ionicons name={icon} size={16} color={palette.accent} />
      <Text style={{ color: palette.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: palette.ink, fontWeight: "800" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
