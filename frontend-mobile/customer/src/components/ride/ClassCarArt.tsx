import { View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { brand } from "../../theme/tokens";
import { usePalette } from "../../theme/Theme";
import type { ClassId } from "../../lib/fare";

const bodies: Record<string, { paint: string; glass: string; accent: string; kind: "sedan" | "suv" | "hatch" | "luxury" | "keke" }> = {
  ryde: { paint: "#C8CED6", glass: "#D7E8F5", accent: brand.orange, kind: "sedan" },
  along: { paint: "#4F7EB5", glass: "#D7E8F5", accent: brand.lemonDeep, kind: "sedan" },
  comfort: { paint: "#2B2B2B", glass: "#C9D8E6", accent: "#8A8A8A", kind: "sedan" },
  xl: { paint: "#A8B0BA", glass: "#D7E8F5", accent: brand.orange, kind: "suv" },
  executive: { paint: "#111111", glass: "#9EB4C8", accent: brand.gold, kind: "luxury" },
  green: { paint: "#6F9B4A", glass: "#D7E8F5", accent: brand.lemonDeep, kind: "hatch" },
  keke: { paint: brand.lemon, glass: "#F4F8C8", accent: brand.orange, kind: "keke" },
};

export function ClassCarArt({ classId, selected, width = 72, height = 44 }: { classId: string; selected?: boolean; width?: number; height?: number }) {
  const palette = usePalette();
  const look = bodies[classId] ?? bodies.ryde;
  const paint = selected ? look.paint : look.paint;
  const rim = selected ? palette.accent : "#1A140C";

  return (
    <View style={{ width, height, borderRadius: 12, backgroundColor: selected ? palette.accentSoft : palette.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Svg width={width - 8} height={height - 6} viewBox="0 0 120 70">
        {look.kind === "keke" ? <Keke paint={paint} glass={look.glass} accent={look.accent} rim={rim} /> : null}
        {look.kind === "suv" ? <Suv paint={paint} glass={look.glass} accent={look.accent} rim={rim} /> : null}
        {look.kind === "hatch" ? <Hatch paint={paint} glass={look.glass} accent={look.accent} rim={rim} /> : null}
        {look.kind === "luxury" ? <Luxury paint={paint} glass={look.glass} accent={look.accent} rim={rim} /> : null}
        {look.kind === "sedan" ? <Sedan paint={paint} glass={look.glass} accent={look.accent} rim={rim} along={classId === "along"} /> : null}
      </Svg>
    </View>
  );
}

export function classVehicleLabel(classId: ClassId | string) {
  switch (classId) {
    case "along":
      return "Shared sedan";
    case "comfort":
      return "Newer sedan";
    case "xl":
      return "SUV / 6 seats";
    case "executive":
      return "Luxury sedan";
    case "green":
      return "Hybrid hatch";
    case "keke":
      return "Keke napep";
    default:
      return "Everyday sedan";
  }
}

function Sedan({ paint, glass, accent, rim, along }: { paint: string; glass: string; accent: string; rim: string; along?: boolean }) {
  return (
    <>
      <Ellipse cx="60" cy="58" rx="46" ry="5" fill="rgba(0,0,0,0.12)" />
      <Path d="M18 44 C22 28, 34 18, 48 16 L78 16 C94 18, 104 28, 108 42 L110 48 C98 52, 28 52, 14 48 Z" fill={paint} />
      <Path d="M40 18 L52 18 L48 34 L34 34 Z" fill={glass} opacity={0.95} />
      <Path d="M54 18 L76 18 L80 34 L50 34 Z" fill={glass} opacity={0.9} />
      <Path d="M16 44 H110" stroke={accent} strokeWidth="2.2" />
      <Circle cx="34" cy="50" r="8" fill={rim} />
      <Circle cx="34" cy="50" r="3.5" fill="#E8E2D8" />
      <Circle cx="92" cy="50" r="8" fill={rim} />
      <Circle cx="92" cy="50" r="3.5" fill="#E8E2D8" />
      {along ? (
        <>
          <Circle cx="58" cy="28" r="3.2" fill={accent} />
          <Circle cx="70" cy="28" r="3.2" fill={accent} />
          <Circle cx="46" cy="28" r="3.2" fill={accent} />
        </>
      ) : null}
    </>
  );
}

function Luxury({ paint, glass, accent, rim }: { paint: string; glass: string; accent: string; rim: string }) {
  return (
    <>
      <Ellipse cx="60" cy="58" rx="50" ry="5" fill="rgba(0,0,0,0.14)" />
      <Path d="M12 46 C18 30, 36 16, 52 14 L86 14 C102 16, 112 28, 116 44 L116 50 C100 54, 24 54, 10 50 Z" fill={paint} />
      <Path d="M42 16 L56 16 L54 34 L36 34 Z" fill={glass} />
      <Path d="M58 16 L84 16 L90 34 L56 34 Z" fill={glass} opacity={0.92} />
      <Path d="M18 44 H112" stroke={accent} strokeWidth="1.8" />
      <Rect x="22" y="40" width="10" height="3" rx="1" fill={accent} />
      <Circle cx="32" cy="51" r="8.5" fill={rim} />
      <Circle cx="32" cy="51" r="3.4" fill="#D8D2C6" />
      <Circle cx="96" cy="51" r="8.5" fill={rim} />
      <Circle cx="96" cy="51" r="3.4" fill="#D8D2C6" />
    </>
  );
}

function Suv({ paint, glass, accent, rim }: { paint: string; glass: string; accent: string; rim: string }) {
  return (
    <>
      <Ellipse cx="60" cy="58" rx="48" ry="5" fill="rgba(0,0,0,0.14)" />
      <Path d="M16 48 H108 C110 48, 112 46, 112 42 L110 24 C108 18, 100 14, 92 14 L34 14 C24 14, 16 20, 14 28 L12 42 C12 46, 14 48, 16 48 Z" fill={paint} />
      <Rect x="28" y="18" width="22" height="16" rx="2" fill={glass} />
      <Rect x="52" y="18" width="36" height="16" rx="2" fill={glass} opacity={0.92} />
      <Path d="M14 40 H110" stroke={accent} strokeWidth="2" />
      <Circle cx="34" cy="50" r="9" fill={rim} />
      <Circle cx="34" cy="50" r="3.6" fill="#E8E2D8" />
      <Circle cx="92" cy="50" r="9" fill={rim} />
      <Circle cx="92" cy="50" r="3.6" fill="#E8E2D8" />
    </>
  );
}

function Hatch({ paint, glass, accent, rim }: { paint: string; glass: string; accent: string; rim: string }) {
  return (
    <>
      <Ellipse cx="60" cy="58" rx="44" ry="5" fill="rgba(0,0,0,0.12)" />
      <Path d="M20 46 C24 30, 38 18, 54 16 L78 16 C92 18, 102 28, 104 42 L104 48 C90 52, 34 52, 18 48 Z" fill={paint} />
      <Path d="M44 18 L70 18 L74 34 L42 34 Z" fill={glass} />
      <Path d="M72 18 L86 22 L84 34 L76 34 Z" fill={glass} opacity={0.88} />
      <Path d="M22 42 H100" stroke={accent} strokeWidth="2" />
      <Circle cx="36" cy="50" r="8" fill={rim} />
      <Circle cx="36" cy="50" r="3.4" fill="#E8E2D8" />
      <Circle cx="90" cy="50" r="8" fill={rim} />
      <Circle cx="90" cy="50" r="3.4" fill="#E8E2D8" />
      <Path d="M58 12 C60 8, 66 8, 68 12" stroke={accent} strokeWidth="2" fill="none" />
    </>
  );
}

function Keke({ paint, glass, accent, rim }: { paint: string; glass: string; accent: string; rim: string }) {
  return (
    <>
      <Ellipse cx="62" cy="58" rx="40" ry="5" fill="rgba(0,0,0,0.12)" />
      <Path d="M34 46 L42 22 H86 C94 22, 100 28, 100 36 V46 Z" fill={paint} />
      <Path d="M46 24 H82 V36 H46 Z" fill={glass} />
      <Path d="M28 46 L40 30 L48 30 L40 46 Z" fill={accent} />
      <Circle cx="30" cy="48" r="7" fill={rim} />
      <Circle cx="30" cy="48" r="2.8" fill="#E8E2D8" />
      <Circle cx="78" cy="50" r="8" fill={rim} />
      <Circle cx="78" cy="50" r="3.2" fill="#E8E2D8" />
      <Circle cx="96" cy="50" r="8" fill={rim} />
      <Circle cx="96" cy="50" r="3.2" fill="#E8E2D8" />
      <Rect x="52" y="38" width="28" height="6" rx="2" fill={accent} />
    </>
  );
}
