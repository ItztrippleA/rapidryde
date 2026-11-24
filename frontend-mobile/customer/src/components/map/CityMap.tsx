import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { usePalette } from "../../theme/Theme";
import { brand } from "../../theme/tokens";
import type { Pin } from "../../lib/geo";

export function CityMap({
  coords,
  pickup,
  dropoff,
  driver,
  searching,
  onDrag,
}: {
  coords?: Pin | null;
  pickup?: (Pin & { label?: string }) | null;
  dropoff?: (Pin & { label?: string }) | null;
  stops?: Pin[];
  driver?: Pin | null;
  cars?: Pin[];
  searching?: boolean;
  pickCenter?: boolean;
  pickPoint?: { x: number; y: number } | null;
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
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.map }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 640">
        <Path d="M0 160h360M0 280h360M0 400h360M0 520h360M80 40v600M180 40v600M270 40v600" stroke={palette.road} strokeWidth="16" />
        {pickup && dropoff ? (
          <Path d="M90 460 C 140 360, 180 340, 250 220" stroke={palette.mode === "dark" ? brand.gold : brand.orange} strokeWidth="5" fill="none" strokeLinecap="round" />
        ) : null}
        <Circle cx={coords ? 180 : 200} cy={coords ? 340 : 360} r="8" fill={palette.ink} />
        {pickup ? <Circle cx="90" cy="460" r="9" fill={brand.lemonDeep} /> : null}
        {dropoff ? <Circle cx="250" cy="220" r="9" fill={palette.accent} /> : null}
        {driver ? <Circle cx="150" cy="390" r="11" fill={brand.orange} /> : null}
      </Svg>
      <Animated.View style={[{ position: "absolute", left: 16, top: 16 }, style]}>
        <View style={{ backgroundColor: palette.paper, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
          <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "700" }}>{searching ? "Looking nearby" : coords ? "Abuja · you are here" : "Waiting for a location fix"}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
