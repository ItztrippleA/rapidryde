import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CityMap } from "../../components/map/CityMap";
import { Logo } from "../../components/ui/Logo";
import { PlacesAutocomplete, placesAutocompleteReady } from "../../components/places/PlacesAutocomplete";
import { usePalette } from "../../theme/Theme";
import { brand } from "../../theme/tokens";
import { displayName, useCustomerStore, type CustomerTrip } from "../../store/useCustomerStore";
import { clockLabel, whenLabel } from "../../lib/format";
import { backfillGenericPlaceLabels, isGenericPlaceLabel, type Place } from "../../lib/places";
import { kmBetween } from "../../lib/geo";
import { estimateRoute } from "../../lib/routing";
import { useNearbyDrivers } from "../../hooks/useNearbyDrivers";
import { useLivePresenceBoard } from "../../hooks/useLivePresenceBoard";

type PlaceSheetKind = "home" | "work" | "recent";

export default function Home() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  /** Reserve the lower half for the booking sheet so pins + path stay in the top half. */
  const sheetPad = Math.round(height * 0.52);
  const profile = useCustomerStore((s) => s.profile);
  const notices = useCustomerStore((s) => s.notices);
  const coords = useCustomerStore((s) => s.coords);
  const startTrip = useCustomerStore((s) => s.startTrip);
  const swapEnds = useCustomerStore((s) => s.swapEnds);
  const clearBookingFilters = useCustomerStore((s) => s.clearBookingFilters);
  const home = useCustomerStore((s) => s.home);
  const work = useCustomerStore((s) => s.work);
  const recent = useCustomerStore((s) => s.recent);
  const trips = useCustomerStore((s) => s.trips);
  const saveHome = useCustomerStore((s) => s.saveHome);
  const saveWork = useCustomerStore((s) => s.saveWork);
  const trip = useCustomerStore((s) => s.trip);
  const scheduled = useCustomerStore((s) => s.scheduled);
  const upcoming = scheduled.filter((item) => item.scheduledAt && item.stage !== "cancelled" && item.stage !== "completed");
  const booking = useCustomerStore((s) => s.booking);
  const [open, setOpen] = useState(false);
  const [placeSheet, setPlaceSheet] = useState<PlaceSheetKind | null>(null);
  const placesReady = placesAutocompleteReady();
  const visited = useMemo(() => {
    const seen = new Set<string>();
    const places: Place[] = [];
    const add = (place?: Place | null) => {
      if (!place?.label || isGenericPlaceLabel(place.label)) return;
      if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
      const key = place.label.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      places.push(place);
    };
    for (const place of recent) add(place);
    const history = [...trips].sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt));
    for (const item of history) {
      if (item.stage === "cancelled") continue;
      add(item.dropoff);
      add(item.pickup);
    }
    return places.slice(0, 12);
  }, [recent, trips]);
  const unread = notices.filter((item) => !item.read).length;
  const activeTrip = trip && trip.stage !== "completed" && trip.stage !== "cancelled" ? trip : null;
  const nextScheduled = upcoming[0] ?? null;
  const here = coords ?? { latitude: 9.0765, longitude: 7.3986 };
  const [tripMinutes, setTripMinutes] = useState<number | null>(null);
  const mapPickup = booking.dropoff
    ? booking.pickup || { latitude: here.latitude, longitude: here.longitude, label: "Pickup" }
    : null;
  /** Live cars near pickup once a route is set, otherwise near you. */
  const carHub = mapPickup || here;
  const nearbyCars = useNearbyDrivers(carHub);
  const board = useLivePresenceBoard(coords ?? here, displayName(profile));
  const peers = board.peers;
  const cars = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ id: string; latitude: number; longitude: number; heading: number }> = [];
    const push = (car: { id: string; latitude: number; longitude: number; heading: number }) => {
      if (seen.has(car.id)) return;
      seen.add(car.id);
      rows.push(car);
    };
    for (const car of nearbyCars) push(car);
    for (const peer of peers) {
      if (peer.role !== "driver") continue;
      push({
        id: peer.id,
        latitude: peer.latitude,
        longitude: peer.longitude,
        heading: peer.heading != null && peer.heading >= 0 ? peer.heading : 0,
      });
    }
    return rows;
  }, [nearbyCars, peers]);
  const peerRiders = peers.filter((peer) => peer.role === "customer");


  const closestPickupMin = useMemo(() => {
    if (!mapPickup || !cars.length) return null;
    let best = Infinity;
    for (const car of cars) {
      const km = kmBetween(car, mapPickup);
      const minutes = Math.max(1, Math.round(((km * 1.25) / 28) * 60));
      if (minutes < best) best = minutes;
    }
    return Number.isFinite(best) ? best : null;
  }, [cars, mapPickup?.latitude, mapPickup?.longitude]);
  const pickupEta = closestPickupMin != null ? `${closestPickupMin} min` : null;
  const dropoffEta =
    booking.dropoff && tripMinutes != null
      ? clockLabel(Date.now() + ((closestPickupMin ?? 0) + tripMinutes) * 60_000)
      : null;

  useEffect(() => {
    if (!booking.dropoff) {
      setTripMinutes(null);
      return;
    }
    const from = booking.pickup || here;
    let alive = true;
    void estimateRoute(from, booking.dropoff, booking.stops).then((estimate) => {
      if (alive) setTripMinutes(estimate.minutes);
    });
    return () => {
      alive = false;
    };
  }, [
    booking.dropoff?.latitude,
    booking.dropoff?.longitude,
    booking.pickup?.latitude,
    booking.pickup?.longitude,
    booking.stops,
    here.latitude,
    here.longitude,
  ]);

  useEffect(() => {
    let alive = true;
    const state = useCustomerStore.getState();
    const needsWork =
      state.recent.some((place) => isGenericPlaceLabel(place.label)) ||
      state.trips.some((item) => isGenericPlaceLabel(item.pickup.label) || isGenericPlaceLabel(item.dropoff.label)) ||
      (state.booking.pickup && isGenericPlaceLabel(state.booking.pickup.label)) ||
      (state.booking.dropoff && isGenericPlaceLabel(state.booking.dropoff.label));
    if (!needsWork) return;
    void backfillGenericPlaceLabels({
      trips: state.trips,
      recent: state.recent,
      booking: state.booking,
    }).then((next) => {
      if (!alive) return;
      useCustomerStore.setState({
        ...(next.trips ? { trips: next.trips as CustomerTrip[] } : {}),
        ...(next.recent ? { recent: next.recent } : {}),
        ...(next.booking
          ? {
              booking: {
                ...state.booking,
                pickup: next.booking.pickup ?? state.booking.pickup,
                dropoff: next.booking.dropoff ?? state.booking.dropoff,
                stops: next.booking.stops ?? state.booking.stops,
              },
            }
          : {}),
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let gone = false;
    void import("../../lib/seedPickup").then(({ seedPickupFromGps }) => {
      if (gone) return;
      void seedPickupFromGps();
    });
    return () => {
      gone = true;
    };
  }, []);

  function choose(place: Place) {
    setPlaceSheet(null);
    startTrip(place);
    router.push("/book");
  }

  function savePlace(kind: "home" | "work", place: Place) {
    if (kind === "home") saveHome(place);
    else saveWork(place);
    setPlaceSheet(null);
    choose(place);
  }

  function openShortcut(kind: PlaceSheetKind) {
    if (kind === "home") {
      if (home) choose(home);
      else setPlaceSheet("home");
      return;
    }
    if (kind === "work") {
      if (work) choose(work);
      else setPlaceSheet("work");
      return;
    }
    setPlaceSheet("recent");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <CityMap
        coords={here}
        pickup={mapPickup}
        dropoff={booking.dropoff}
        cars={cars}
        pickupEta={booking.dropoff ? pickupEta : null}
        dropoffEta={booking.dropoff ? dropoffEta : null}
        contentBottomPad={booking.dropoff ? sheetPad : 0}
        onMarkerPress={(kind) =>
          router.push(kind === "pickup" ? "/search?target=pickup&zoom=street" : "/search?target=dropoff&zoom=street")
        }
      />
      <View
        style={{
          position: "absolute",
          top: insets.top + 60,
          left: insets.left + 16,
          right: insets.right + 16,
          backgroundColor: "rgba(15,18,22,0.82)",
          borderRadius: 14,
          padding: 10,
          gap: 4,
          zIndex: 20,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>LIVE LOCATIONS</Text>
        <Text style={{ color: "#9CC4FF", fontSize: 12 }}>
          You · {here.latitude.toFixed(5)}, {here.longitude.toFixed(5)}
        </Text>
        <Text style={{ color: "#F0D9A8", fontSize: 12 }}>
          Drivers nearby · {cars.length}
          {cars[0] ? ` · ${cars[0].latitude.toFixed(5)}, ${cars[0].longitude.toFixed(5)}` : ""}
        </Text>
        <Text style={{ color: "#E8EEF4", fontSize: 12 }}>Other riders · {peerRiders.length}</Text>
        <Text style={{ color: "#A8B4C0", fontSize: 11 }}>
          Session · {board.selfRole || "…"}
          {board.selfId ? ` · ${board.selfId}` : ""}
          {" · "}board {board.boardSize}
        </Text>
      </View>
      <View style={{ position: "absolute", top: insets.top + 8, left: insets.left + 16, right: insets.right + 16, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Logo width={108} />
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Schedule a ride" onPress={() => { clearBookingFilters(); router.push("/schedule"); }} style={chip(palette.paper)}>
            <Ionicons name="calendar" size={20} color={palette.ink} />
            {upcoming.length ? (
              <View style={{ position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: palette.accentInk, fontSize: 10, fontWeight: "800" }}>{upcoming.length}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => router.push("/notifications")} style={chip(palette.paper)}>
            <Ionicons name="notifications-outline" size={20} color={palette.ink} />
            {unread ? <View style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent }} /> : null}
          </Pressable>
          <Pressable onPress={() => router.push("/account")} style={chip(palette.paper)}>
            <Text style={{ color: palette.ink, fontWeight: "700" }}>{displayName(profile).slice(0, 1)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ position: "absolute", left: insets.left + 16, right: insets.right + 16, bottom: Math.max(insets.bottom, 8) + 16, gap: 10 }}>
        {nextScheduled || activeTrip ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            {nextScheduled ? (
              <TripGlyph
                icon="calendar"
                label="Scheduled"
                title={nextScheduled.dropoff.label.split(",")[0]}
                detail={nextScheduled.scheduledAt ? whenLabel(nextScheduled.scheduledAt) : "Time not set"}
                onPress={() => router.push({ pathname: "/schedule", params: { id: nextScheduled.id } })}
              />
            ) : null}
            {activeTrip ? (
              <TripGlyph
                icon={activeTrip.stage === "searching" ? "search" : "car-sport"}
                label="Current"
                title={activeTrip.stage === "searching" ? "Finding driver" : activeTrip.driver?.name || "In progress"}
                detail={activeTrip.dropoff.label.split(",")[0]}
                onPress={() => router.push(activeTrip.stage === "searching" ? "/matching" : "/trip")}
              />
            ) : null}
          </View>
        ) : null}
        <View style={[card(palette.paper, palette.line), { gap: 12 }]}>
          {booking.dropoff ? (
            <RouteSheet
              pickup={booking.pickup}
              dropoff={booking.dropoff}
              onPickup={() => router.push("/search?target=pickup&zoom=street")}
              onDropoff={() => router.push("/search?target=dropoff&zoom=street")}
              onSwap={swapEnds}
              onContinue={() => router.push("/book")}
            />
          ) : (
            <Pressable
              onPress={() => {
                clearBookingFilters();
                setOpen(true);
                router.push("/search?target=dropoff");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "700" }}>Where are you going?</Text>
                <Text style={{ color: palette.muted, marginTop: 4 }} numberOfLines={2}>
                  {booking.pickup ? `From ${fullPlace(booking.pickup.label)}` : "Search a destination"}
                </Text>
              </View>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="search" size={20} color={palette.accentInk} />
              </View>
            </Pressable>
          )}
          {open ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>RYDE10</Text>
              <Text style={{ color: palette.ink }}>10% off city rides, capped at ₦2,000.</Text>
              <Pressable onPress={() => router.push("/safety")}>
                <Text style={{ color: palette.accent, fontWeight: "700" }}>Safety and trip sharing</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setOpen(true)}>
              <Text style={{ color: palette.accent, fontWeight: "700" }}>Promos and safety</Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Shortcut icon="home" label="Home" place={home} onPress={() => openShortcut("home")} />
          <Shortcut icon="briefcase" label="Work" place={work} onPress={() => openShortcut("work")} />
          <Shortcut icon="time" label="Recent" place={recent[0] ?? visited[0] ?? null} onPress={() => openShortcut("recent")} />
        </View>
      </View>

      <Modal visible={placeSheet != null} transparent animationType="slide" onRequestClose={() => setPlaceSheet(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setPlaceSheet(null)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              maxHeight: "78%",
              backgroundColor: palette.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 10,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
              gap: 12,
            }}
          >
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: palette.line }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "800" }}>
                  {placeSheet === "home" ? "Set home" : placeSheet === "work" ? "Set work" : "Recent places"}
                </Text>
                <Text style={{ color: palette.muted, lineHeight: 20 }}>
                  {placeSheet === "recent"
                    ? "Pick a place you have been to lately."
                    : `Save a ${placeSheet} address so you can ride there in one tap.`}
                </Text>
              </View>
              <Pressable
                onPress={() => setPlaceSheet(null)}
                hitSlop={10}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.raised, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={20} color={palette.ink} />
              </Pressable>
            </View>

            {placeSheet === "home" || placeSheet === "work" ? (
              <View style={{ gap: 10, zIndex: 20 }}>
                {placesReady ? (
                  <View style={{ backgroundColor: palette.paper, borderRadius: 16, borderWidth: 1, borderColor: palette.line, padding: 8, overflow: "visible" }}>
                    <PlacesAutocomplete
                      placeholder={placeSheet === "home" ? "Search home address" : "Search work address"}
                      autoFocus
                      origin={here}
                      predefined={visited}
                      onPlace={(place) => savePlace(placeSheet, place)}
                    />
                  </View>
                ) : (
                  <Text style={{ color: palette.muted }}>Search needs a Places key. Pick a recent place or use the map.</Text>
                )}
                <Pressable
                  onPress={() => {
                    const target = placeSheet;
                    setPlaceSheet(null);
                    router.push(`/search?target=${target}&zoom=street`);
                  }}
                  style={{
                    minHeight: 48,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: palette.line,
                    backgroundColor: palette.paper,
                    paddingHorizontal: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons name="map-outline" size={18} color={palette.accent} />
                  <Text style={{ color: palette.ink, fontWeight: "700" }}>Pin on the map</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "800" }}>
              {placeSheet === "recent" ? "RECENTLY VISITED" : "OR PICK A RECENT PLACE"}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 0 }}>
              {visited.length === 0 ? (
                <Text style={{ color: palette.muted, paddingVertical: 12 }}>No recent places yet. Finish a ride or search a destination first.</Text>
              ) : (
                visited.map((place, index) => (
                  <Pressable
                    key={`${place.id}-${index}`}
                    onPress={() => {
                      if (placeSheet === "home" || placeSheet === "work") savePlace(placeSheet, place);
                      else choose(place);
                    }}
                    style={{
                      minHeight: 56,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderTopWidth: index ? 1 : 0,
                      borderColor: palette.line,
                      paddingVertical: 10,
                    }}
                  >
                    <Ionicons
                      name={placeSheet === "home" ? "home-outline" : placeSheet === "work" ? "briefcase-outline" : "time-outline"}
                      size={20}
                      color={palette.accent}
                    />
                    <Text style={{ flex: 1, color: palette.ink, fontWeight: "700" }} numberOfLines={2}>
                      {fullPlace(place.label)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={palette.muted} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function fullPlace(label?: string | null) {
  const text = (label || "").trim();
  if (!text || isGenericPlaceLabel(text)) return "Choose";
  return text;
}

function RouteSheet({
  pickup,
  dropoff,
  onPickup,
  onDropoff,
  onSwap,
  onContinue,
}: {
  pickup: Place | null;
  dropoff: Place;
  onPickup: () => void;
  onDropoff: () => void;
  onSwap: () => void;
  onContinue: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
        <View style={{ width: 18, alignItems: "center", paddingTop: 18, paddingBottom: 18 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: brand.lemonDeep, borderWidth: 2, borderColor: "#FFFFFF" }} />
          <View style={{ flex: 1, width: 2, backgroundColor: palette.line, marginVertical: 4 }} />
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: brand.orange, borderWidth: 2, borderColor: "#FFFFFF" }} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pickup ${pickup?.label || "not set"}`}
            onPress={onPickup}
            style={{
              minHeight: 56,
              borderRadius: 16,
              backgroundColor: palette.raised,
              paddingHorizontal: 14,
              paddingVertical: 10,
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Text style={{ color: palette.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>PICKUP</Text>
            <Text numberOfLines={2} style={{ color: palette.ink, fontSize: 15, fontWeight: "800" }}>
              {pickup ? fullPlace(pickup.label) : "Set pickup"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Destination ${dropoff.label}`}
            onPress={onDropoff}
            style={{
              minHeight: 56,
              borderRadius: 16,
              backgroundColor: palette.raised,
              paddingHorizontal: 14,
              paddingVertical: 10,
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Text style={{ color: palette.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>DESTINATION</Text>
            <Text numberOfLines={2} style={{ color: palette.ink, fontSize: 15, fontWeight: "800" }}>
              {fullPlace(dropoff.label)}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Swap pickup and destination"
          onPress={onSwap}
          style={{
            alignSelf: "center",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: palette.paper,
            borderWidth: 1,
            borderColor: palette.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="swap-vertical" size={18} color={palette.ink} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue to book"
        onPress={onContinue}
        style={{
          minHeight: 48,
          borderRadius: 16,
          backgroundColor: palette.accent,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        <Text style={{ color: palette.accentInk, fontWeight: "800", fontSize: 16 }}>See fares</Text>
        <Ionicons name="arrow-forward" size={18} color={palette.accentInk} />
      </Pressable>
    </View>
  );
}

function TripGlyph({
  icon,
  label,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${title}. ${detail}`}
      onPress={onPress}
      style={{
        width: 132,
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: palette.paper,
        borderWidth: 1,
        borderColor: palette.line,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={15} color={palette.accent} />
        </View>
        <Text style={{ color: palette.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 }}>{label.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: palette.ink, fontSize: 13, fontWeight: "800" }}>{title}</Text>
      <Text numberOfLines={1} style={{ color: palette.muted, fontSize: 11 }}>{detail}</Text>
    </Pressable>
  );
}

function Shortcut({ icon, label, place, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; place: Place | null; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 52, borderRadius: 12, backgroundColor: palette.raised, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Ionicons name={icon} size={18} color={palette.accent} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: palette.ink, fontWeight: "700" }}>{label}</Text>
        <Text numberOfLines={2} style={{ color: palette.muted, fontSize: 11 }}>{place ? fullPlace(place.label) : "Add"}</Text>
      </View>
    </Pressable>
  );
}

function chip(background: string) {
  return { width: 44, height: 44, borderRadius: 22, backgroundColor: background, alignItems: "center" as const, justifyContent: "center" as const };
}

function card(background: string, line: string) {
  return { backgroundColor: background, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: line };
}
