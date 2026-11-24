import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export function Rise({
  children,
  index = 0,
  from = "down",
  style,
}: {
  children: ReactNode;
  index?: number;
  from?: "down" | "up";
  style?: StyleProp<ViewStyle>;
}) {
  const motion = from === "up" ? FadeInUp : FadeInDown;
  return (
    <Animated.View entering={motion.delay(Math.min(index, 8) * 70).duration(460)} style={style}>
      {children}
    </Animated.View>
  );
}

export const fill = StyleSheet.absoluteFill;
