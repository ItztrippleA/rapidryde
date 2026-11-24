import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../../theme/Theme";
import { brand } from "../../theme/tokens";
import { kmBetween, type Pin } from "../../lib/geo";
import { bearing, type NearbyCar } from "../../lib/dummy";
import { fetchRoutePath } from "../../lib/routing";

const ABUJA = { latitude: 9.0765, longitude: 7.3986 };

/**
 * Google on Android. Apple Maps on iOS — PROVIDER_GOOGLE crashes Fabric when the
 * Google Maps iOS pod isn’t in the installed binary (Expo config key alone is not enough).
 */
const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

/** ~street-block zoom so pin adjustments are easy to judge. */
const STREET_DELTA = 0.0026;
/** Slightly wider when opening pick mode without an explicit street zoom. */
const PICK_DELTA = 0.008;

export function CityMap({
  coords,
  pickup,
  dropoff,
  stops,
  driver,
  cars,
  onDrag,
  onDragStart,
  pickCenter,
  /** Screen point of the fixed pin tip. Defaults to top-center of the map. */
  pickPoint,
  pickBottomPad = 0,
  /** Keep route markers in the visible top half above a bottom sheet. */
  contentBottomPad = 0,
  /** Force street-block camera when adjusting a pin. */
  streetZoom = false,
  /** Closest car minutes to pickup, e.g. "3 min". */
  pickupEta,
  /** Arrival clock / trip time on dropoff, e.g. "4:52 PM". */
  dropoffEta,
  /** When set with a driver pin, draw the approach route driver → pickup. */
  approachLeg = false,
  onMarkerPress,
}: {
  coords?: Pin | null;
  pickup?: (Pin & { label?: string }) | null;
  dropoff?: (Pin & { label?: string }) | null;
  stops?: Pin[];
  driver?: Pin | null;
  cars?: NearbyCar[];
  searching?: boolean;
  /** Fixed-pin pick mode: parent draws the pin; map pans underneath. */
  pickCenter?: boolean;
  pickPoint?: { x: number; y: number } | null;
  /** Extra bottom padding so the sheet does not cover the focus area. */
  pickBottomPad?: number;
  contentBottomPad?: number;
  streetZoom?: boolean;
  pickupEta?: string | null;
  dropoffEta?: string | null;
  approachLeg?: boolean;
  onMarkerPress?: (kind: "pickup" | "drop") => void;
  onDrag?: (pin: Pin) => void;
  onDragStart?: () => void;
}) {
  const palette = usePalette();
  const mapRef = useRef<MapView>(null);
  const lastPinNav = useRef(0);
  const window = useWindowDimensions();
  const [layout, setLayout] = useState({ width: window.width, height: window.height });
  const width = layout.width || window.width;
  const height = layout.height || window.height;
  const safeStops = (stops ?? []).filter((pin): pin is Pin => Boolean(pin && Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)));
  const [drivePath, setDrivePath] = useState<Pin[]>([]);
  const [shimmerAt, setShimmerAt] = useState(0);
  const focus = pickCenter ? pickup || dropoff || coords || ABUJA : null;
  const routeCoords = useMemo(() => {
    if (pickCenter) return [] as Pin[];
    if (drivePath.length >= 2) return drivePath;
    if (approachLeg && driver && pickup) return [driver, pickup];
    if (!pickup || !dropoff) return [] as Pin[];
    return [pickup, ...safeStops, dropoff];
  }, [
    pickCenter,
    approachLeg,
    driver?.latitude,
    driver?.longitude,
    pickup?.latitude,
    pickup?.longitude,
    dropoff?.latitude,
    dropoff?.longitude,
    drivePath,
    safeStops,
  ]);
  const shimmerPath = useMemo(() => densifyPath(routeCoords, 48), [routeCoords]);
  const shimmerSegment = useMemo(
    () => sliceLoop(shimmerPath, shimmerAt, Math.max(6, Math.round(shimmerPath.length * 0.14))),
    [shimmerAt, shimmerPath],
  );
  const pickDelta = streetZoom || pickCenter ? STREET_DELTA : PICK_DELTA;
  const points = pickCenter
    ? [focus].filter((pin): pin is Pin => Boolean(pin))
    : [coords, pickup, ...safeStops, dropoff, driver].filter((pin): pin is Pin => Boolean(pin));
  const base = frame(points.length ? points : [ABUJA], pickCenter ? pickDelta : undefined);
  const anchor = pickPoint || { x: width / 2, y: Math.max(120, height * 0.22) };
  /** Shift region so the focus lat/lng sits under the top pin, not the screen middle. */
  const region = pickCenter
    ? streetRegion(focus || ABUJA, height, anchor.y, pickDelta)
    : base;
  const driverHeading = useHeading(driver);
  const bottomPad = pickCenter ? pickBottomPad : contentBottomPad;

  useEffect(() => {
    if (pickCenter) {
      setDrivePath([]);
      return;
    }
    let alive = true;
    if (approachLeg && driver && pickup) {
      void fetchRoutePath(driver, pickup, []).then((path) => {
        if (alive) setDrivePath(path.length >= 2 ? path : [driver, pickup]);
      });
      return () => {
        alive = false;
      };
    }
    if (!pickup || !dropoff) {
      setDrivePath([]);
      return;
    }
    void fetchRoutePath(pickup, dropoff, safeStops).then((path) => {
      if (alive) setDrivePath(path.length >= 2 ? path : [pickup, ...safeStops, dropoff]);
    });
    return () => {
      alive = false;
    };
  }, [
    pickCenter,
    approachLeg,
    driver?.latitude,
    driver?.longitude,
    pickup?.latitude,
    pickup?.longitude,
    dropoff?.latitude,
    dropoff?.longitude,
    safeStops.map((stop) => `${stop.latitude},${stop.longitude}`).join("|"),
  ]);

  /** Silver highlight that runs along the route like a lining. */
  useEffect(() => {
    if (shimmerPath.length < 4) {
      setShimmerAt(0);
      return;
    }
    const timer = setInterval(() => {
      setShimmerAt((index) => (index + 1) % shimmerPath.length);
    }, 36);
    return () => clearInterval(timer);
  }, [shimmerPath]);

  /** Pick / adjust mode: zoom once to street level under the fixed pin tip (not on every drag). */
  useEffect(() => {
    if (!pickCenter || !focus) return;
    const next = streetRegion(focus, height, anchor.y, pickDelta);
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(next, 420);
    }, 80);
    return () => clearTimeout(timer);
    // Remount via parent `key` when the seed pin changes; ignore live drag updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot street zoom
  }, [pickCenter, streetZoom, pickDelta, height, anchor.y]);

  useEffect(() => {
    if (pickCenter || !mapRef.current) return;
    if (!pickup || !dropoff) return;
    /** Always include both ends so neither pin is dropped from the camera. */
    const routePoints =
      drivePath.length >= 2 ? drivePath : [pickup, ...safeStops, dropoff];
    const fitPoints = [pickup, dropoff, ...routePoints];
    /** Overlay sheet on full-screen maps; 0 = map band (book/fares) uses the whole view. */
    const sheetRatio = bottomPad > 0 ? Math.min(0.58, bottomPad / Math.max(height, 1)) : 0;
    const next = topHalfRegion(fitPoints, sheetRatio, width, height);
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(next, 350);
    }, 200);
    return () => clearTimeout(timer);
  }, [
    bottomPad,
    drivePath,
    dropoff?.latitude,
    dropoff?.longitude,
    height,
    width,
    pickCenter,
    pickup?.latitude,
    pickup?.longitude,
    safeStops.length,
  ]);

  async function reportPin(fallback: Pin) {
    if (!onDrag) return;
    if (pickCenter && mapRef.current) {
      try {
        const coord = await mapRef.current.coordinateForPoint(anchor);
        if (coord && Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude)) {
          onDrag({ latitude: coord.latitude, longitude: coord.longitude });
          return;
        }
      } catch {
        /* fall back to region centre */
      }
    }
    onDrag(fallback);
  }

  function openPin(kind: "pickup" | "drop") {
    const now = Date.now();
    if (now - lastPinNav.current < 450) return;
    lastPinNav.current = now;
    onMarkerPress?.(kind);
  }

  /**
   * Custom marker hit-testing is unreliable on Apple Maps (label works, pin body often
   * misses). Resolve taps in screen space against the pin tip + head + label.
   */
  async function hitTestPinPress(position?: { x: number; y: number } | null) {
    if (!onMarkerPress || !mapRef.current || !position) return;
    const candidates: { kind: "pickup" | "drop"; pin: Pin }[] = [];
    if (pickup) candidates.push({ kind: "pickup", pin: pickup });
    if (dropoff) candidates.push({ kind: "drop", pin: dropoff });
    let best: { kind: "pickup" | "drop"; dist: number } | null = null;
    for (const candidate of candidates) {
      try {
        const tip = await mapRef.current.pointForCoordinate(candidate.pin);
        /** Tip is the anchor; head and label sit above it in the custom marker. */
        const spots = [
          tip,
          { x: tip.x, y: tip.y - 28 },
          { x: tip.x, y: tip.y - 52 },
          { x: tip.x, y: tip.y - 72 },
          { x: tip.x, y: tip.y - 96 },
        ];
        const dist = Math.min(...spots.map((spot) => Math.hypot(spot.x - position.x, spot.y - position.y)));
        if (dist <= 52 && (!best || dist < best.dist)) best = { kind: candidate.kind, dist };
      } catch {
        /* ignore projection failures */
      }
    }
    if (best) openPin(best.kind);
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.fill}
      provider={mapProvider}
      userInterfaceStyle={palette.mode}
      mapType="standard"
      loadingEnabled
      loadingBackgroundColor={palette.map}
      initialRegion={
        !pickCenter && pickup && dropoff
          ? topHalfRegion(
              [pickup, dropoff, ...safeStops],
              bottomPad > 0 ? Math.min(0.58, bottomPad / Math.max(height, 1)) : 0,
              width,
              height,
            )
          : region
      }
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width > 0 && next.height > 0) {
          setLayout((prev) =>
            Math.abs(prev.width - next.width) < 1 && Math.abs(prev.height - next.height) < 1
              ? prev
              : { width: next.width, height: next.height },
          );
        }
      }}
      showsUserLocation={Boolean(pickCenter && coords)}
      showsMyLocationButton={false}
      onPress={(event) => {
        if (pickCenter || !onMarkerPress) return;
        void hitTestPinPress(event.nativeEvent.position);
      }}
      onRegionChange={onDrag ? () => onDragStart?.() : undefined}
      onRegionChangeComplete={
        onDrag
          ? (next) => {
              void reportPin({ latitude: next.latitude, longitude: next.longitude });
            }
          : undefined
      }
    >
      {routeCoords.length >= 2 ? (
        <>
          <Polyline
            coordinates={routeCoords}
            strokeColor="rgba(26, 20, 12, 0.22)"
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            tappable={false}
          />
          <Polyline
            coordinates={routeCoords}
            strokeColor={brand.orange}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            tappable={false}
          />
          {shimmerSegment.length >= 2 ? (
            <Polyline
              coordinates={shimmerSegment}
              strokeColor="#F2F5F8"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              tappable={false}
            />
          ) : null}
        </>
      ) : null}
      {!pickCenter && coords ? <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}><YouMark /></Marker> : null}
      {(cars ?? []).map((car) => (
        <Marker key={car.id} coordinate={car} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
          <Vehicle heading={car.heading} />
        </Marker>
      ))}
      {!pickCenter && pickup ? (
        <>
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={18} tappable={false}>
            <PinFoot color={brand.lemonDeep} />
          </Marker>
          <Marker
            coordinate={pickup}
            anchor={{ x: 0.5, y: 1 }}
            centerOffset={pinCenterOffset(Boolean(pickupEta))}
            tracksViewChanges
            zIndex={20}
            tappable
            onPress={(event) => {
              event.stopPropagation?.();
              openPin("pickup");
            }}
          >
            <PinMark kind="pickup" label={shortPinLabel(pickup.label, "Pickup")} eta={pickupEta} />
          </Marker>
        </>
      ) : null}
      {!pickCenter && dropoff ? (
        <>
          <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={18} tappable={false}>
            <PinFoot color={brand.orange} />
          </Marker>
          <Marker
            coordinate={dropoff}
            anchor={{ x: 0.5, y: 1 }}
            centerOffset={pinCenterOffset(Boolean(dropoffEta))}
            tracksViewChanges
            zIndex={21}
            tappable
            onPress={(event) => {
              event.stopPropagation?.();
              openPin("drop");
            }}
          >
            <PinMark kind="drop" label={shortPinLabel(dropoff.label, "Dropoff")} eta={dropoffEta} />
          </Marker>
        </>
      ) : null}
      {!pickCenter
        ? safeStops.map((stop, index) => (
            <Marker
              key={`${stop.latitude}-${index}`}
              coordinate={stop}
              anchor={{ x: 0.5, y: 1 }}
              centerOffset={pinCenterOffset(false)}
              tracksViewChanges={false}
              zIndex={19}
            >
              <PinMark kind="stop" label={shortPinLabel((stop as Pin & { label?: string }).label, "Stop")} />
            </Marker>
          ))
        : null}
      {!pickCenter && driver ? (
        <Marker coordinate={driver} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
          <Vehicle heading={driverHeading} />
        </Marker>
      ) : null}
    </MapView>
  );
}

function YouMark() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#1A73E8", borderWidth: 3, borderColor: "#FFFFFF" }} />
  );
}

/** Top-down car. The nose points north until `heading` turns it. */
function Vehicle({ heading }: { heading: number }) {
  return (
    <View style={{ width: 26, height: 34, alignItems: "center", justifyContent: "center", transform: [{ rotate: `${heading}deg` }] }}>
      <Svg width={20} height={28} viewBox="0 0 28 36">
        <Ellipse cx="14" cy="20" rx="8" ry="12" fill="rgba(0,0,0,0.22)" />
        <Path d="M8.4 12C8.4 6 10.8 2.5 14 2.5C17.2 2.5 19.6 6 19.6 12L20.2 25C20.2 32 17.6 34.2 14 34.2C10.4 34.2 7.8 32 7.8 25Z" fill={brand.orange} />
        <Path d="M10.2 11C10.5 7.6 17.5 7.6 17.8 11L17.3 14.6C14 13.4 10.7 13.4 10.7 14.6Z" fill="#E7F6FF" />
        <Path d="M10.6 24.5C11 27.4 17 27.4 17.4 24.5L16.8 22C14 23.2 11.2 23.2 11.2 22Z" fill="#1A140C" opacity={0.45} />
        <Rect x="2.4" y="10" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <Rect x="22.4" y="10" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <Rect x="2.4" y="21" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <Rect x="22.4" y="21" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
      </Svg>
    </View>
  );
}

function useHeading(pin?: Pin | null) {
  const previous = useRef<Pin | null>(null);
  const [heading, setHeading] = useState(0);
  useEffect(() => {
    if (!pin) return;
    const last = previous.current;
    if (last && kmBetween(last, pin) > 0.008) setHeading((bearing(last, pin) + 360) % 360);
    previous.current = pin;
  }, [pin, pin?.latitude, pin?.longitude]);
  return heading;
}

function shortPinLabel(label: string | undefined, fallback: string) {
  const text = (label || "").trim();
  if (!text || /^pinned on the map$/i.test(text) || /^current location$/i.test(text)) return fallback;
  return text.split(",")[0]?.trim() || fallback;
}

const PIN_H = 64;
const PIN_H_ETA = 78;

/** Apple Maps often ignores `anchor` on custom views and centers them — shift so the tip sits on the lat/lng. */
function pinCenterOffset(hasEta: boolean) {
  if (Platform.OS !== "ios") return undefined;
  const height = hasEta ? PIN_H_ETA : PIN_H;
  return { x: 0, y: -height / 2 };
}

/** Dot on the true coordinate so the path clearly meets the pin tip, not the head. */
function PinFoot({ color }: { color: string }) {
  return (
    <View
      collapsable={false}
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: "#FFFFFF",
      }}
    />
  );
}

function PinMark({
  kind,
  label,
  eta,
}: {
  kind: "pickup" | "drop" | "stop" | "driver";
  label: string;
  eta?: string | null;
}) {
  const color = kind === "pickup" ? brand.lemonDeep : kind === "stop" ? brand.gold : brand.orange;
  const ink = kind === "pickup" || kind === "stop" ? "#1A140C" : "#FFFFFF";
  const icon = kind === "pickup" ? "navigate" : kind === "drop" ? "flag" : kind === "stop" ? "ellipsis-horizontal" : "car";
  const etaText = (eta || "").trim();
  const height = etaText ? PIN_H_ETA : PIN_H;
  return (
    /**
     * Tip is flush with the bottom edge so the route meets the pin foot
     * (same lat/lng as the polyline endpoint), not the circle centre.
     */
    <View
      collapsable={false}
      style={{
        width: 84,
        height,
        alignItems: "center",
        justifyContent: "flex-end",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <View
        style={{
          maxWidth: 80,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 7,
          backgroundColor: "#FFFFFF",
          marginBottom: 3,
          alignItems: "center",
          gap: 0,
        }}
      >
        {etaText ? (
          <Text numberOfLines={1} style={{ color: color, fontSize: 10, fontWeight: "900" }}>
            {etaText}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={{ color: "#1A140C", fontSize: 8, fontWeight: "800" }}>
          {label}
        </Text>
      </View>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFF" }}>
        <Ionicons name={icon} size={13} color={ink} />
      </View>
      <View style={{ width: 2, height: 8, backgroundColor: color }} />
    </View>
  );
}

function frame(points: Pin[], minDelta = 0.04) {
  const box = bounds(points);
  const latitudeDelta = Math.max(minDelta, box.latSpan * 1.8 || minDelta);
  const longitudeDelta = Math.max(minDelta, box.lngSpan * 1.8 || minDelta);
  return {
    latitude: box.latitude,
    longitude: box.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function bounds(points: Pin[]) {
  const first = points[0] ?? ABUJA;
  let minLat = first.latitude;
  let maxLat = first.latitude;
  let minLng = first.longitude;
  let maxLng = first.longitude;
  for (const point of points) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  }
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latSpan: Math.max(maxLat - minLat, 0.0015),
    lngSpan: Math.max(maxLng - minLng, 0.0015),
  };
}

/**
 * Frame the route in the top half, stretching pins nearly edge-to-edge horizontally
 * so pickup/dropoff read clearly above the sheet.
 */
function topHalfRegion(points: Pin[], sheetRatio = 0.5, screenWidth = 390, screenHeight = 844) {
  const visible = Math.max(0.42, 1 - Math.max(0, Math.min(0.7, sheetRatio)));
  const box = bounds(points);
  /** Leave clear side inset so pin chips aren’t flush against the screen edge. */
  const horizontalFill = 0.78;
  /** Use most of the visible band for the route height. */
  const verticalFill = sheetRatio > 0 ? 0.78 : 0.86;

  let longitudeDelta = Math.max(box.lngSpan / horizontalFill, 0.012);
  let latitudeDelta = Math.max(box.latSpan / (verticalFill * visible), 0.012);

  /** Keep region aspect close to the map view so edge-to-edge width holds. */
  const aspect = Math.max(0.55, screenWidth / Math.max(1, screenHeight));
  const aspectLng = latitudeDelta * aspect;
  if (aspectLng > longitudeDelta) {
    longitudeDelta = aspectLng;
  } else {
    const matchedLat = longitudeDelta / aspect;
    if (matchedLat >= box.latSpan / (verticalFill * visible)) {
      latitudeDelta = matchedLat;
    } else {
      latitudeDelta = Math.max(latitudeDelta, box.latSpan / (verticalFill * visible));
      longitudeDelta = Math.max(longitudeDelta, latitudeDelta * aspect);
    }
  }

  /** When a bottom sheet covers the map, shift content into the upper band. */
  const shift = sheetRatio > 0 ? latitudeDelta * ((1 - visible) / 2) : 0;
  return {
    latitude: box.latitude - shift,
    longitude: box.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

/** Street-level camera with the pin lat/lng under a fixed screen Y (tip of the overlay pin). */
function streetRegion(pin: Pin, screenHeight: number, tipY: number, delta = STREET_DELTA) {
  const latitudeDelta = delta;
  const longitudeDelta = delta;
  return {
    latitude: pin.latitude - latitudeDelta * ((screenHeight / 2 - tipY) / screenHeight),
    longitude: pin.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

/** Evenly sample a route so the silver lining can glide smoothly. */
function densifyPath(points: Pin[], target = 48): Pin[] {
  if (points.length < 2) return points;
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i].latitude - points[i - 1].latitude, points[i].longitude - points[i - 1].longitude);
    seg.push(d);
    total += d;
  }
  if (total <= 0) return points;
  const out: Pin[] = [points[0]];
  const step = total / Math.max(2, target - 1);
  let walked = 0;
  let cursor = 0;
  for (let i = 1; i < target - 1; i += 1) {
    const want = i * step;
    while (cursor < seg.length && walked + seg[cursor] < want) {
      walked += seg[cursor];
      cursor += 1;
    }
    if (cursor >= seg.length) break;
    const t = seg[cursor] <= 0 ? 0 : (want - walked) / seg[cursor];
    const a = points[cursor];
    const b = points[cursor + 1];
    out.push({
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    });
  }
  out.push(points[points.length - 1]);
  return out;
}

function sliceLoop(points: Pin[], start: number, length: number): Pin[] {
  if (points.length < 2 || length < 2) return [];
  const out: Pin[] = [];
  for (let i = 0; i < length; i += 1) out.push(points[(start + i) % points.length]);
  return out;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
});
