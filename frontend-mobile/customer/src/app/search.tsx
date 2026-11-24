import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette } from "../theme/Theme";
import { brand } from "../theme/tokens";
import { useCustomerStore } from "../store/useCustomerStore";
import { readDevicePosition } from "../lib/devicePosition";
import { backfillGenericPlaceLabels, isGenericPlaceLabel, resolvePinnedPlace, reverseGeocodeLabel, type Place } from "../lib/places";
import type { Pin } from "../lib/geo";
import { CityMap } from "../components/map/CityMap";
import { PlacesAutocomplete, placesAutocompleteReady } from "../components/places/PlacesAutocomplete";

/** Pin column height from label top through stem tip (ground shadow sits on tip). */
const PIN_STACK = 92;

const ABUJA = { latitude: 9.0765, longitude: 7.3986 };

function seedPin(
  target: string,
  booking: { pickup: Place | null; dropoff: Place | null; stops: Place[] },
  coords: Pin | null,
): Pin {
  if (target === "pickup" && booking.pickup) return booking.pickup;
  if (target === "dropoff" && booking.dropoff) return booking.dropoff;
  if (target === "stop" && booking.stops.length) return booking.stops[booking.stops.length - 1];
  if (coords) return coords;
  return ABUJA;
}

function confirmLabel(target: string) {
  if (target === "pickup") return "Confirm pickup here";
  if (target === "stop") return "Confirm stop here";
  if (target === "home") return "Save home here";
  if (target === "work") return "Save work here";
  return "Confirm destination here";
}

export default function Search() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ target?: string; zoom?: string }>();
  const target = params.target || "dropoff";
  const streetZoom = params.zoom === "street" || params.zoom !== "wide";
  const remember = useCustomerStore((s) => s.rememberPlace);
  const setPickup = useCustomerStore((s) => s.setPickup);
  const setDropoff = useCustomerStore((s) => s.setDropoff);
  const setCoords = useCustomerStore((s) => s.setCoords);
  const addStop = useCustomerStore((s) => s.addStop);
  const saveHome = useCustomerStore((s) => s.saveHome);
  const saveWork = useCustomerStore((s) => s.saveWork);
  const recent = useCustomerStore((s) => s.recent);
  const coords = useCustomerStore((s) => s.coords);
  const booking = useCustomerStore((s) => s.booking);
  const ready = placesAutocompleteReady();
  const recentPlaces = recent.slice(0, 5);

  useEffect(() => {
    if (!recent.some((place) => isGenericPlaceLabel(place.label))) return;
    let alive = true;
    void backfillGenericPlaceLabels({ recent }).then((next) => {
      if (!alive || !next.recent) return;
      useCustomerStore.setState({ recent: next.recent });
    });
    return () => {
      alive = false;
    };
  }, []);

  const initial = useMemo(() => seedPin(target, booking, coords), [booking, coords, target]);
  const [pin, setPin] = useState<Pin>(initial);
  const [pinLabel, setPinLabel] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  /** Bump so CityMap remounts / recenters when GPS jumps the pin. */
  const [mapSeed, setMapSeed] = useState(0);
  useEffect(() => {
    setPin(initial);
  }, [initial.latitude, initial.longitude, target, streetZoom]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void reverseGeocodeLabel(pin).then((label) => {
        if (alive) setPinLabel(label);
      });
    }, 280);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pin.latitude, pin.longitude]);
  /** 0 = planted, 1 = lifted while the map is moving. */
  const lift = useSharedValue(0);
  const pinStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [-0.15, 0, 1], [4, 0, -22]) },
      { scale: interpolate(lift.value, [-0.15, 0, 1], [0.94, 1, 1.08]) },
    ],
  }));
  const headShadowStyle = useAnimatedStyle(() => ({
    shadowColor: "#000000",
    shadowOpacity: interpolate(lift.value, [0, 1], [0.28, 0.18]),
    shadowRadius: interpolate(lift.value, [0, 1], [5, 10]),
    shadowOffset: {
      width: 0,
      height: interpolate(lift.value, [0, 1], [3, 8]),
    },
    elevation: interpolate(lift.value, [0, 1], [5, 10]),
  }));
  const groundShadowStyle = useAnimatedStyle(() => ({
    width: interpolate(lift.value, [-0.15, 0, 1], [8, 14, 22]),
    height: interpolate(lift.value, [-0.15, 0, 1], [3, 5, 7]),
    opacity: interpolate(lift.value, [-0.15, 0, 1], [0.42, 0.32, 0.14]),
    transform: [{ scaleX: interpolate(lift.value, [-0.15, 0, 1], [0.85, 1, 1.35]) }],
  }));

  function raisePin() {
    lift.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.7 });
  }

  function dropPin() {
    lift.value = withSequence(
      withTiming(0, { duration: 170, easing: Easing.in(Easing.cubic) }),
      withTiming(-0.14, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 11, stiffness: 340, mass: 0.55 }),
    );
  }

  const kind = target === "pickup" || target === "home" ? "pickup" : target === "stop" ? "stop" : "drop";
  const pinColor = kind === "pickup" ? brand.lemonDeep : kind === "stop" ? brand.gold : brand.orange;
  const pinInk = kind === "drop" ? "#FFFFFF" : "#1A140C";
  const pinIcon = kind === "pickup" ? "navigate" : kind === "stop" ? "ellipsis-horizontal" : "flag";
  /** Search bar block sits under the status bar; pin tip sits just below it, top-center. */
  const searchBarBottom = insets.top + 8 + 64;
  const pinTop = searchBarBottom + 12;
  const pickPoint = useMemo(
    () => ({ x: width / 2, y: pinTop + PIN_STACK }),
    [pinTop, width],
  );
  const pickBottomPad = Math.round(height * 0.4 + insets.bottom);

  async function choose(place: Place) {
    remember(place);
    if (target === "pickup") setPickup(place);
    else if (target === "stop") {
      if (!addStop(place)) return;
    } else if (target === "home") saveHome(place);
    else if (target === "work") saveWork(place);
    else setDropoff(place);
    if (target === "home" || target === "work") {
      router.back();
      return;
    }
    router.replace("/book");
  }

  async function useHere() {
    if (locating || confirming) return;
    setLocating(true);
    setLocateError("");
    try {
      // Lat/lng from Expo Location (or emulator fallback). Label is reverse-geocode only.
      const fix = await readDevicePosition(6_000, coords);
      if (!fix.ok) {
        setLocateError(
          fix.reason === "denied"
            ? "Allow location access in Settings, then try again."
            : "Could not read your position. Check GPS and try again.",
        );
        return;
      }
      const here = fix.pin;
      setCoords(here);
      setPin(here);
      setMapSeed((value) => value + 1);
      const label =
        (await reverseGeocodeLabel(here)) ||
        (fix.source === "simulator" ? "Current location (simulator)" : "Current location");
      setPinLabel(label);
      await choose({
        id: "here",
        label,
        ...here,
      });
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <CityMap
        key={`pick-${target}-${streetZoom ? "street" : "wide"}-s${mapSeed}`}
        coords={coords}
        pickup={kind === "drop" ? null : pin}
        dropoff={kind === "drop" ? pin : null}
        pickCenter
        streetZoom={streetZoom}
        pickPoint={pickPoint}
        pickBottomPad={pickBottomPad}
        onDragStart={raisePin}
        onDrag={(next) => {
          setPin(next);
          setLocateError("");
          dropPin();
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: pinTop,
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <Animated.View style={[{ alignItems: "center" }, pinStyle]}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: "#FFFFFF",
              marginBottom: 6,
              shadowColor: "#000000",
              shadowOpacity: 0.16,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            }}
          >
            <Text style={{ color: "#1A140C", fontSize: 10, fontWeight: "800" }}>
              {target === "pickup" ? "Pickup" : target === "stop" ? "Stop" : target === "home" ? "Home" : target === "work" ? "Work" : "Destination"}
            </Text>
          </View>
          <Animated.View
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: pinColor,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              },
              headShadowStyle,
            ]}
          >
            <Ionicons name={pinIcon} size={20} color={pinInk} />
          </Animated.View>
          <View style={{ width: 3, height: 14, backgroundColor: pinColor, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
          <Animated.View
            style={[
              {
                marginTop: 2,
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.35)",
              },
              groundShadowStyle,
            ]}
          />
        </Animated.View>
      </View>

      <View style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, zIndex: 30 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: palette.paper, borderRadius: 18, padding: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: 2 }}
          >
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {ready ? (
              <PlacesAutocomplete
                placeholder={target === "pickup" ? "Search a pickup" : target === "stop" ? "Search a stop" : "Search a destination"}
                autoFocus
                origin={coords}
                onPlace={(place) => void choose(place)}
              />
            ) : (
              <Text style={{ color: palette.muted, marginTop: 8, marginBottom: 8 }}>
                Google Places key missing. Move the map pin or use a recent place.
              </Text>
            )}
          </View>
          <Ionicons name={target === "pickup" ? "navigate" : "flag"} size={18} color={palette.accent} style={{ marginTop: 12 }} />
        </View>
      </View>

      <Animated.View
        entering={FadeInDown.duration(420)}
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: insets.bottom + 12,
          maxHeight: "42%",
          borderRadius: 24,
          backgroundColor: palette.paper,
          padding: 14,
          gap: 8,
          zIndex: 20,
        }}
      >
        <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "800" }} numberOfLines={2}>
          {pinLabel || "Finding this place…"}
        </Text>
        <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18 }}>
          Move the map — the pin stays at the top. Stop when it sits on your {target === "pickup" ? "pickup" : target === "stop" ? "stop" : "destination"}.
        </Text>
        {target === "pickup" || target === "home" || target === "work" ? (
          <View style={{ gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my position"
              disabled={locating || confirming}
              onPress={() => void useHere()}
              style={{ minHeight: 44, justifyContent: "center", opacity: locating ? 0.7 : 1 }}
            >
              <Text style={{ color: palette.accent, fontWeight: "800" }}>
                {locating ? "Finding your position…" : "Use my position"}
              </Text>
            </Pressable>
            {locateError ? (
              <Text style={{ color: "#C4482D", fontSize: 12, lineHeight: 18 }}>{locateError}</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>RECENT</Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 0 }}>
          {recentPlaces.length === 0 ? (
            <Text style={{ color: palette.muted, paddingVertical: 8 }}>No recent places yet.</Text>
          ) : (
            recentPlaces.map((place, index) => (
              <Pressable
                key={`${place.id}-${index}`}
                onPress={() => void choose(place)}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: palette.line,
                }}
              >
                <Ionicons name={target === "pickup" ? "navigate-circle" : "location"} size={20} color={palette.accent} />
                <Text style={{ flex: 1, color: palette.ink, fontWeight: "700" }} numberOfLines={2}>
                  {isGenericPlaceLabel(place.label) ? "Finding place…" : place.label}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel(target)}
          disabled={confirming}
          onPress={() => {
            if (confirming) return;
            setConfirming(true);
            void (async () => {
              try {
                const place = pinLabel
                  ? { id: `pin-${pin.latitude.toFixed(5)},${pin.longitude.toFixed(5)}`, label: pinLabel, ...pin }
                  : await resolvePinnedPlace(pin);
                await choose(place);
              } finally {
                setConfirming(false);
              }
            })();
          }}
          style={{
            minHeight: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.accent,
            opacity: confirming ? 0.7 : 1,
          }}
        >
          <Text style={{ color: palette.accentInk, fontWeight: "800" }}>
            {confirming ? "Saving…" : confirmLabel(target)}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
