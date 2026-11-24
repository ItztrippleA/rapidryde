import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { useCustomerStore } from "../store/useCustomerStore";
import { estimateFare, isSampleRoute, pricing, routeKm, type ClassId } from "../lib/fare";
import { naira, whenLabel } from "../lib/format";
import type { Place } from "../lib/places";
import { availablePools, poolCarsOnMap, poolStops, seatsLeft, type PricedPool } from "../lib/pool";
import { firstOpenSeat, seatLabel } from "../lib/seats";
import { CityMap } from "../components/map/CityMap";
import { CabinPicker, CabinSeatSummary, cabinColour } from "../components/ride/CabinPicker";
import { ClassCarArt, classVehicleLabel } from "../components/ride/ClassCarArt";
import { estimateRoute, etaLabel, type RouteEstimate } from "../lib/routing";
import { useNearbyDrivers } from "../hooks/useNearbyDrivers";

function validStops(value: Place[] | null | undefined): Place[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (stop): stop is Place =>
      Boolean(stop && typeof stop.id === "string" && stop.id && typeof stop.label === "string" && stop.label && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)),
  );
}

const blurbs: Record<string, string> = {
  ryde: "Everyday car",
  along: "Shared seats on your path",
  comfort: "Newer car, more room",
  xl: "Room for a group",
  executive: "Quiet cabin",
  green: "Lower emissions",
  keke: "Neighbourhood keke",
};

export default function Book() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  /** Top map band — pins frame edge-to-edge inside this strip. */
  const mapBand = Math.max(260, Math.round(screenH * 0.34));
  const booking = useCustomerStore((s) => s.booking);
  const coords = useCustomerStore((s) => s.coords);
  const wallet = useCustomerStore((s) => s.wallet);
  const swapEnds = useCustomerStore((s) => s.swapEnds);
  const setClass = useCustomerStore((s) => s.setClass);
  const setPool = useCustomerStore((s) => s.setPool);
  const setSeat = useCustomerStore((s) => s.setSeat);
  const setPayment = useCustomerStore((s) => s.setPayment);
  const setPromo = useCustomerStore((s) => s.setPromo);
  const removeStop = useCustomerStore((s) => s.removeStop);
  const moveStop = useCustomerStore((s) => s.moveStop);
  const setSchedule = useCustomerStore((s) => s.setSchedule);
  const [promo, setPromoText] = useState(booking.promo);
  const [details, setDetails] = useState(false);
  const [promoOpen, setPromoOpen] = useState(Boolean(booking.promo));
  const [alongOpen, setAlongOpen] = useState(false);
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const hub = booking.pickup || coords || { latitude: 9.0765, longitude: 7.3986 };
  const liveCars = useNearbyDrivers(hub);

  const along = booking.classId === "along";
  const stops = useMemo(() => validStops(booking.stops), [booking.stops]);

  useEffect(() => {
    const raw = booking.stops;
    if (Array.isArray(raw) && raw.length === stops.length) return;
    const current = useCustomerStore.getState().booking;
    useCustomerStore.setState({ booking: { ...current, stops } });
  }, [booking.stops, stops]);

  useEffect(() => {
    if (!booking.pickup || !booking.dropoff) {
      setRoute(null);
      return;
    }
    let alive = true;
    const load = () => {
      void estimateRoute(booking.pickup!, booking.dropoff!, stops).then((estimate) => {
        if (alive) setRoute(estimate);
      });
    };
    load();
    const timer = setInterval(load, 75_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [booking.dropoff, booking.pickup, stops]);

  const pools = useMemo(() => availablePools(booking.pickup, booking.dropoff), [booking.dropoff, booking.pickup]);
  const selectedPool = pools.find((car) => car.id === booking.poolId) ?? null;
  const mapStops = selectedPool ? poolStops(selectedPool, booking.pickup, booking.dropoff) : stops;
  const mapCars = along ? poolCarsOnMap(pools) : liveCars;
  const km = useMemo(() => {
    if (route?.km) return route.km;
    if (!booking.pickup || !booking.dropoff) return 0;
    return routeKm(booking.pickup, booking.dropoff, stops);
  }, [booking.dropoff, booking.pickup, route?.km, stops]);
  const trafficMinutes = route?.minutes;

  const sample = Boolean(booking.pickup && booking.dropoff && stops.length === 0 && isSampleRoute(booking.pickup.label, booking.dropoff.label));
  const parts = useMemo(
    () => estimateFare(km || 1, booking.classId, promo, sample, trafficMinutes),
    [booking.classId, km, promo, sample, trafficMinutes],
  );
  const aloneAlong = useMemo(
    () => estimateFare(km || 1, "along", promo, sample, trafficMinutes).quote,
    [km, promo, sample, trafficMinutes],
  );
  const fare = selectedPool ? selectedPool.yourFare : parts.quote;
  const short = (label?: string) => (label || "").split(",")[0] || "Choose";

  function chooseClass(rideId: ClassId, quote: number) {
    if (rideId === "along") {
      setClass("along", aloneAlong);
      if (!booking.poolId) {
        if (pools[0]) {
          setPool(pools[0].id, pools[0].yourFare, pools[0].routeQuote);
          setSeat(firstOpenSeat(pools[0].taken));
        } else {
          setPool("", aloneAlong, aloneAlong);
          setSeat(firstOpenSeat(0));
        }
      } else if (booking.seatIndex < 0) {
        setSeat(firstOpenSeat(selectedPool?.taken ?? 0));
      }
      setAlongOpen(true);
      return;
    }
    setAlongOpen(false);
    setPool("");
    setClass(rideId, quote);
  }

  function choosePool(car: PricedPool) {
    setPool(car.id, car.yourFare, car.routeQuote);
    setSeat(firstOpenSeat(car.taken));
  }

  function chooseNewAlong() {
    setPool("", aloneAlong, aloneAlong);
    setSeat(firstOpenSeat(0));
  }

  const seatIndex = booking.seatIndex >= 0 ? booking.seatIndex : firstOpenSeat(selectedPool?.taken ?? 0);

  function applyPromo() {
    setPromo(promo.trim().toUpperCase());
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ height: mapBand }}>
        <CityMap
          pickup={booking.pickup}
          dropoff={booking.dropoff}
          stops={mapStops}
          cars={mapCars}
          contentBottomPad={0}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={{ position: "absolute", top: insets.top + 8, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(420)} style={{ flex: 1, marginTop: -28, backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 4, backgroundColor: palette.line, marginTop: 10 }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 12, gap: 14 }}>
          <View>
            <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "800" }}>YOUR RIDE</Text>
            <Text style={{ color: palette.ink, fontSize: 26, fontWeight: "800" }}>
              {km ? `${km.toFixed(1)} km` : "Set the route"}
              {route ? ` · ${etaLabel(route)}` : trafficMinutes ? ` · ${trafficMinutes} min` : ""}
            </Text>
            {booking.scheduledAt ? (
              <Text style={{ color: palette.accent, fontWeight: "700", marginTop: 4 }}>{whenLabel(booking.scheduledAt)}</Text>
            ) : null}
          </View>

          <View style={{ backgroundColor: palette.paper, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 12 }}>
            <StopRow kind="pickup" label={short(booking.pickup?.label)} hint={booking.pickup ? "Pickup" : "Choose pickup"} onPress={() => router.push("/search?target=pickup")} />
            {stops.map((stop, index) => (
              <View key={stop.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <StopRow kind="stop" label={short(stop.label)} hint={`Stop ${index + 1}`} />
                </View>
                <Pressable onPress={() => moveStop(stop.id, -1)} hitSlop={8}><Ionicons name="chevron-up" size={18} color={palette.muted} /></Pressable>
                <Pressable onPress={() => moveStop(stop.id, 1)} hitSlop={8}><Ionicons name="chevron-down" size={18} color={palette.muted} /></Pressable>
                <Pressable onPress={() => removeStop(stop.id)} hitSlop={8}><Ionicons name="close" size={18} color="#C4482D" /></Pressable>
              </View>
            ))}
            <StopRow kind="drop" label={short(booking.dropoff?.label)} hint={booking.dropoff ? "Destination" : "Choose destination"} onPress={() => router.push("/search?target=dropoff")} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={swapEnds} style={[pill(palette.raised, palette.line), { flex: 1, justifyContent: "center" }]}>
                <Ionicons name="swap-vertical" size={16} color={palette.ink} />
                <Text style={{ color: palette.ink, fontWeight: "700" }}>Swap</Text>
              </Pressable>
              <Pressable disabled={stops.length >= 2} onPress={() => router.push("/search?target=stop")} style={[pill(palette.raised, palette.line), { flex: 1, justifyContent: "center", opacity: stops.length >= 2 ? 0.45 : 1 }]}>
                <Ionicons name="add" size={16} color={palette.ink} />
                <Text style={{ color: palette.ink, fontWeight: "700" }}>Stop {stops.length}/2</Text>
              </Pressable>
            </View>
            {booking.scheduledAt ? (
              <Pressable onPress={() => setSchedule(null)}>
                <Text style={{ color: palette.accent, fontWeight: "700" }}>Send this ride now instead</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            {route?.isTrafficHeavy ? (
              <Text style={{ color: "#C4482D", fontWeight: "700" }}>Heavy traffic on this route</Text>
            ) : null}

            {pricing.classes.map((ride) => {
              const row = estimateFare(km || 1, ride.id, promo, sample, trafficMinutes);
              const selected = booking.classId === ride.id;
              const price = ride.id === "along" ? (selectedPool?.yourFare || aloneAlong) : row.quote;
              return (
                <Pressable
                  key={ride.id}
                  onPress={() => chooseClass(ride.id as ClassId, row.quote)}
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? palette.accent : palette.line,
                    backgroundColor: selected ? palette.accentSoft : palette.paper,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <ClassCarArt classId={ride.id} selected={selected} width={78} height={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }}>{ride.label}</Text>
                    <Text style={{ color: palette.muted }}>{classVehicleLabel(ride.id)} · {etaLabel(route) || `${row.minutes} min`}</Text>
                    <Text style={{ color: palette.muted, fontSize: 12 }}>{blurbs[ride.id] || "Ride"}</Text>
                  </View>
                  <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }}>{naira(price)}</Text>
                </Pressable>
              );
            })}
          </View>

          {along ? (
            <Pressable
              onPress={() => setAlongOpen(true)}
              style={{ backgroundColor: palette.paper, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 10 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>Your Along seat</Text>
                <Text style={{ color: palette.accent, fontWeight: "700" }}>Change</Text>
              </View>
              <CabinPicker
                compact
                taken={selectedPool?.taken ?? 0}
                selectedIndex={seatIndex}
                colour={cabinColour(selectedPool?.colour)}
              />
              <CabinSeatSummary taken={selectedPool?.taken ?? 0} selectedIndex={seatIndex} />
              <Text style={{ color: palette.muted }}>
                {selectedPool
                  ? `${selectedPool.name} · ${selectedPool.colour} ${selectedPool.vehicle} · ${naira(selectedPool.yourFare)}`
                  : `New Along · ${seatLabel(seatIndex)} · ${naira(aloneAlong)}`}
              </Text>
            </Pressable>
          ) : (
            <View style={{ backgroundColor: palette.paper, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>Fare</Text>
                <Pressable onPress={() => setDetails((value) => !value)}>
                  <Text style={{ color: palette.accent, fontWeight: "700" }}>{details ? "Hide breakdown" : "Breakdown"}</Text>
                </Pressable>
              </View>
              <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "800", textAlign: "center" }}>{naira(fare)}</Text>
              <Text style={{ color: palette.muted, textAlign: "center" }}>Set by the quote. Drivers may send a new price after they offer.</Text>
              {details ? (
                <View style={{ gap: 6, paddingTop: 4 }}>
                  <Line label="Base fare" value={naira(parts.base)} />
                  <Line label="Distance" value={naira(parts.distance)} />
                  <Line label="Time" value={naira(parts.time)} />
                  <Line label="Booking fee" value={naira(parts.booking)} />
                  <Line label="Discount" value={parts.discount ? `−${naira(parts.discount)}` : naira(0)} />
                  <Line label="Quote" value={naira(parts.quote)} />
                </View>
              ) : null}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["cash", "wallet", "card"] as const).map((method) => {
              const selected = booking.payment === method;
              const label = method === "cash" ? "Cash" : method === "wallet" ? "Wallet" : "Card";
              const icon = method === "cash" ? "cash-outline" : method === "wallet" ? "wallet-outline" : "card-outline";
              return (
                <Pressable key={method} onPress={() => setPayment(method)} style={{ flex: 1, minHeight: 72, borderRadius: 16, borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.paper, alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Ionicons name={icon} size={18} color={selected ? palette.accent : palette.ink} />
                  <Text style={{ color: palette.ink, fontWeight: "800" }}>{label}</Text>
                  {method === "wallet" ? <Text style={{ color: palette.muted, fontSize: 11 }}>{naira(wallet)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {booking.payment === "wallet" && wallet < fare ? <Text style={{ color: "#C4482D" }}>Wallet balance is below this fare.</Text> : null}

          {promoOpen ? (
            <TextInput
              value={promo}
              onChangeText={setPromoText}
              onEndEditing={applyPromo}
              placeholder="RYDE or RYDE10"
              placeholderTextColor={palette.muted}
              autoCapitalize="characters"
              style={{ minHeight: 52, borderRadius: 16, paddingHorizontal: 16, color: palette.ink, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, fontWeight: "700" }}
            />
          ) : (
            <Pressable onPress={() => setPromoOpen(true)} style={{ minHeight: 48, justifyContent: "center" }}>
              <Text style={{ color: palette.accent, fontWeight: "800" }}>{promo ? `Promo ${promo}` : "Add a promo"}</Text>
            </Pressable>
          )}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              label="Review ride"
              disabled={!booking.pickup || !booking.dropoff}
              onPress={() => {
                const current = useCustomerStore.getState().booking;
                const quote = along ? (selectedPool?.routeQuote || aloneAlong) : parts.quote;
                const lockedFare = along ? (selectedPool?.yourFare || aloneAlong) : quote;
                useCustomerStore.setState({
                  booking: {
                    ...current,
                    quote,
                    fare: lockedFare,
                    promo: promo.trim().toUpperCase(),
                    poolId: along ? current.poolId : "",
                  },
                });
                router.push("/confirm");
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={booking.scheduledAt ? `Scheduled ${whenLabel(booking.scheduledAt)}` : "Schedule for later"}
            onPress={() => router.push("/schedule")}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: palette.paper,
              borderWidth: 1,
              borderColor: booking.scheduledAt ? palette.accent : palette.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={booking.scheduledAt ? palette.accent : palette.ink} />
          </Pressable>
        </View>
      </Animated.View>

      <Modal visible={alongOpen} transparent animationType="slide" onRequestClose={() => setAlongOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close Along" onPress={() => setAlongOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => undefined} style={{ maxHeight: "86%", backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: palette.line }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "800" }}>Choose a seat</Text>
                <Text style={{ color: palette.muted }}>{pools.length} open Along cars nearby</Text>
              </View>
              <Pressable onPress={() => setAlongOpen(false)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.raised, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={palette.ink} />
              </Pressable>
            </View>
            <Text style={{ color: palette.muted, lineHeight: 20 }}>
              Share a car on a similar path. Your fare is based on your distance, and it drops as more seats fill.
            </Text>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: palette.paper, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 10, alignItems: "center" }}>
                <Text style={{ color: palette.ink, fontWeight: "800", alignSelf: "stretch" }}>
                  {selectedPool ? `${selectedPool.colour} ${selectedPool.vehicle}` : "New Along cabin"}
                </Text>
                <CabinPicker
                  taken={selectedPool?.taken ?? 0}
                  selectedIndex={seatIndex}
                  colour={cabinColour(selectedPool?.colour)}
                  onSelect={setSeat}
                />
                <CabinSeatSummary taken={selectedPool?.taken ?? 0} selectedIndex={seatIndex} />
              </View>
              {pools.length === 0 ? (
                <View style={{ backgroundColor: palette.paper, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 6 }}>
                  <Text style={{ color: palette.ink, fontWeight: "700" }}>No open car on this corridor yet.</Text>
                  <Text style={{ color: palette.muted }}>Start an Along. Tap a free seat on the cabin above.</Text>
                  <Text style={{ color: palette.ink, fontWeight: "800" }}>{seatLabel(seatIndex)} · {naira(aloneAlong)}</Text>
                </View>
              ) : (
                pools.map((car) => {
                  const selected = booking.poolId === car.id;
                  const free = seatsLeft(car);
                  return (
                    <Pressable
                      key={car.id}
                      onPress={() => choosePool(car)}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        borderWidth: selected ? 1.5 : 1,
                        borderColor: selected ? palette.accent : palette.line,
                        backgroundColor: selected ? palette.accentSoft : palette.paper,
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <ClassCarArt classId="along" selected={selected} width={70} height={44} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: palette.ink, fontWeight: "800" }}>{car.name}</Text>
                          <Text style={{ color: palette.muted }}>{car.colour} {car.vehicle} · {car.etaMin} min</Text>
                        </View>
                        <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 18 }}>{naira(car.yourFare)}</Text>
                      </View>
                      <CabinPicker
                        compact
                        taken={car.taken}
                        selectedIndex={selected ? seatIndex : firstOpenSeat(car.taken)}
                        colour={cabinColour(car.colour)}
                        onSelect={selected ? setSeat : undefined}
                      />
                      <Text style={{ color: palette.muted }}>
                        {car.taken} seated · {free} open · your {car.yourKm.toFixed(1)} km of {routeKm(car.routePickup, car.routeDropoff, car.stops).toFixed(1)} km
                      </Text>
                      {car.riders.length ? (
                        <View style={{ gap: 4 }}>
                          {car.riders.map((rider, index) => (
                            <Text key={rider.id} style={{ color: palette.ink }}>
                              {seatLabel(index)} · {rider.name} · {short(rider.pickup.label)} → {short(rider.dropoff.label)}
                            </Text>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ color: palette.muted }}>Empty Along · pick any seat on the cabin.</Text>
                      )}
                      {selected ? (
                        <Text style={{ color: palette.accent, fontWeight: "700" }}>
                          {seatLabel(seatIndex)} · {naira(car.yourFare)}. Corridor quote {naira(car.routeQuote)}, split by distance.
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
              <Pressable
                onPress={chooseNewAlong}
                style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: booking.poolId ? palette.line : palette.accent, alignItems: "center", justifyContent: "center", backgroundColor: booking.poolId ? palette.raised : palette.accentSoft }}
              >
                <Text style={{ color: palette.ink, fontWeight: "800" }}>{booking.poolId ? "Start a new Along instead" : "Starting a new Along"}</Text>
              </Pressable>
            </ScrollView>
            <Button label={seatIndex >= 0 ? `Use ${seatLabel(seatIndex).toLowerCase()}` : "Pick a seat"} onPress={() => setAlongOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StopRow({ kind, label, hint, onPress }: { kind: "pickup" | "stop" | "drop"; label: string; hint: string; onPress?: () => void }) {
  const palette = usePalette();
  const color = kind === "pickup" ? "#8FB800" : kind === "stop" ? "#E2B657" : palette.accent;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: kind === "drop" ? 2 : 6, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.muted, fontSize: 11, fontWeight: "800" }}>{hint.toUpperCase()}</Text>
        <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }} numberOfLines={1}>{label}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={palette.muted} /> : null}
    </Pressable>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: palette.muted }}>{label}</Text>
      <Text style={{ color: palette.ink, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function pill(backgroundColor: string, borderColor: string) {
  return { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 12, minHeight: 40, borderRadius: 999, backgroundColor, borderWidth: 1, borderColor };
}
