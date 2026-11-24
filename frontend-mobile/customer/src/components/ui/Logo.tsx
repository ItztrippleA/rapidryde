import { Image, type ImageStyle, type StyleProp } from "react-native";

const RATIO = 1024 / 312;
const dark = require("../../../assets/brand/logo-dark.png");

export function Logo({ width = 168, style }: { width?: number; tone?: "auto" | "onDark"; style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel="Rapyd Ryd" source={dark} resizeMode="contain" style={[{ width, height: width / RATIO }, style]} />;
}
