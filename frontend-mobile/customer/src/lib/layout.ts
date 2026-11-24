import { useWindowDimensions } from "react-native";

/**
 * Size-class style metrics from the current window — not device idiom or orientation.
 * Outer Duo display is typically compact width; inner open display is regular width.
 */
export function useLayoutMetrics() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  const horizontal = width >= 600 ? "regular" : "compact";
  const vertical = height >= 600 ? "regular" : "compact";
  return {
    width,
    height,
    shortest,
    longest,
    horizontal,
    vertical,
    /** Wider than tall — e.g. open Duo / landscape-ish scene. */
    isWide: width > height,
    /** Enough width for side-by-side content on the inner display. */
    canSplit: horizontal === "regular",
  };
}
