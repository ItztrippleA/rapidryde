import { LogBox } from "react-native";

/** RN / Reanimated bridge noise on tab + stack transitions; harmless. */
const ANIMATED_NOISE = /onAnimatedValueUpdate/i;

LogBox.ignoreLogs([
  ANIMATED_NOISE,
  "Sending `onAnimatedValueUpdate` with no listeners registered.",
  /Sending `onAnimatedValueUpdate` with no listeners registered\./i,
]);

type WarnFn = typeof console.warn;

let installed: WarnFn | null = null;

function messageOf(args: unknown[]) {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg && typeof arg === "object" && "message" in arg) return String((arg as { message: unknown }).message);
      return String(arg);
    })
    .join(" ");
}

/** Re-apply after LogBox / Expo patches console.warn on boot or Fast Refresh. */
export function quietAnimatedWarn() {
  if (console.warn === installed) return;
  const previous = console.warn.bind(console);
  const filtered: WarnFn = (...args: Parameters<typeof console.warn>) => {
    if (ANIMATED_NOISE.test(messageOf(args))) return;
    previous(...args);
  };
  installed = filtered;
  console.warn = filtered;
}

quietAnimatedWarn();
