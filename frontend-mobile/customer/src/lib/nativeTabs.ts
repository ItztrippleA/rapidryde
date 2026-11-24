import { DynamicColorIOS, Platform, type ColorValue } from "react-native";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import type { Palette } from "../theme/tokens";

export function iosMajorVersion() {
  if (Platform.OS !== "ios") return 0;
  return Number(String(Platform.Version).split(".")[0]) || 0;
}

export function tabTint(palette: Palette): ColorValue {
  if (Platform.OS === "ios") {
    return DynamicColorIOS({ light: "#FF6A00", dark: "#E2B657" });
  }
  return palette.accent;
}

export function tabLabel(palette: Palette): ColorValue {
  if (Platform.OS === "ios") {
    return DynamicColorIOS({ light: "#6A6156", dark: "#C6B48A" });
  }
  return palette.muted;
}

/**
 * iOS 26+ draws Liquid Glass itself — leave background alone.
 * Older iOS needs an explicit system material + fill, or light mode reads as empty glass.
 */
export function tabBarSurface(palette: Palette) {
  if (Platform.OS === "android") {
    return { backgroundColor: palette.paper as ColorValue };
  }
  if (iosMajorVersion() >= 26) {
    return {};
  }
  const dark = palette.mode === "dark";
  return {
    blurEffect: dark ? ("systemChromeMaterialDark" as const) : ("systemThickMaterialLight" as const),
    // Soft fill so light mode stays frosted over maps / pale screens, not clear.
    backgroundColor: (dark ? "rgba(20,18,14,0.82)" : "rgba(255,255,255,0.86)") as ColorValue,
    disableTransparentOnScrollEdge: true,
  };
}

export function navigationTheme(palette: Palette): Theme {
  const base = palette.mode === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: palette.bg,
      card: palette.paper,
      text: palette.ink,
      border: palette.line,
      primary: palette.accent,
      notification: palette.accent,
    },
  };
}
