import { Pressable, Text, View } from "react-native";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../../theme/Theme";
import { brand } from "../../theme/tokens";
import { CABIN_SEATS, seatTaken, type CabinSeatId } from "../../lib/seats";

type Props = {
  taken: number;
  selectedIndex: number;
  onSelect?: (index: number) => void;
  compact?: boolean;
  colour?: string;
};

export function CabinPicker({ taken, selectedIndex, onSelect, compact, colour }: Props) {
  const palette = usePalette();
  const body = colour || "#5B7FA8";
  const width = compact ? 168 : 220;
  const height = compact ? 220 : 280;

  return (
    <View style={{ alignItems: "center", gap: compact ? 8 : 12 }}>
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Svg width={width} height={height} viewBox="0 0 220 280">
          <Ellipse cx="110" cy="268" rx="70" ry="8" fill="rgba(0,0,0,0.1)" />
          <Path
            d="M48 54 C48 28, 70 14, 110 14 C150 14, 172 28, 172 54 L178 210 C178 242, 152 262, 110 262 C68 262, 42 242, 42 210 Z"
            fill={body}
          />
          <Path d="M62 42 C78 28, 142 28, 158 42 L152 64 H68 Z" fill="rgba(215,232,245,0.9)" />
          <Path d="M56 210 L164 210 L158 246 C146 254, 74 254, 62 246 Z" fill="rgba(0,0,0,0.12)" />
          <Rect x="70" y="78" width="80" height="10" rx="4" fill="rgba(255,255,255,0.28)" />
          <Rect x="44" y="96" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <Rect x="166" y="96" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <Rect x="44" y="168" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <Rect x="166" y="168" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <Path d="M110 70 V250" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="4 6" />
        </Svg>

        <View style={{ position: "absolute", top: compact ? 58 : 74, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: compact ? 18 : 28 }}>
            <DriverSeat compact={compact} />
            <SeatButton
              seatId="front"
              label="Front"
              taken={seatTaken(0, taken)}
              selected={selectedIndex === 0}
              compact={compact}
              onPress={onSelect && !seatTaken(0, taken) ? () => onSelect(0) : undefined}
            />
          </View>
        </View>

        <View style={{ position: "absolute", top: compact ? 128 : 168, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: compact ? 18 : 28 }}>
            <SeatButton
              seatId="rear_left"
              label="Rear L"
              taken={seatTaken(1, taken)}
              selected={selectedIndex === 1}
              compact={compact}
              onPress={onSelect && !seatTaken(1, taken) ? () => onSelect(1) : undefined}
            />
            <SeatButton
              seatId="rear_right"
              label="Rear R"
              taken={seatTaken(2, taken)}
              selected={selectedIndex === 2}
              compact={compact}
              onPress={onSelect && !seatTaken(2, taken) ? () => onSelect(2) : undefined}
            />
          </View>
        </View>
      </View>

      {!compact ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          <Legend swatch={palette.muted} label="Taken" />
          <Legend swatch={palette.accent} label="Your seat" />
          <Legend swatch={palette.raised} label="Open" border={palette.line} />
        </View>
      ) : null}
    </View>
  );
}

function DriverSeat({ compact }: { compact?: boolean }) {
  const size = compact ? 44 : 56;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: "rgba(26,20,12,0.55)",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Ionicons name="person" size={compact ? 16 : 18} color="#F6E7C1" />
      <Text style={{ color: "#F6E7C1", fontSize: 9, fontWeight: "800" }}>Driver</Text>
    </View>
  );
}

function SeatButton({
  seatId,
  label,
  taken,
  selected,
  compact,
  onPress,
}: {
  seatId: CabinSeatId;
  label: string;
  taken: boolean;
  selected: boolean;
  compact?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const size = compact ? 44 : 56;
  const fill = taken ? "rgba(26,20,12,0.35)" : selected ? palette.accent : palette.paper;
  const ink = taken ? palette.muted : selected ? palette.accentInk : palette.ink;
  const ring = selected ? palette.accent : taken ? "transparent" : palette.line;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={taken ? `${label} taken` : `Choose ${label}`}
      disabled={!onPress}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: fill,
        borderWidth: selected ? 2 : 1,
        borderColor: ring,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        opacity: taken ? 0.72 : 1,
      }}
    >
      <Ionicons name={taken || selected ? "person" : "person-outline"} size={compact ? 16 : 18} color={ink} />
      <Text style={{ color: ink, fontSize: 9, fontWeight: "800" }}>{taken ? "Taken" : selected ? "You" : label}</Text>
      {!taken && !selected && !compact ? <Text style={{ position: "absolute", opacity: 0 }}>{seatId}</Text> : null}
    </Pressable>
  );
}

function Legend({ swatch, label, border }: { swatch: string; label: string; border?: string }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: swatch, borderWidth: border ? 1 : 0, borderColor: border }} />
      <Text style={{ color: palette.muted, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function CabinSeatSummary({ taken, selectedIndex }: { taken: number; selectedIndex: number }) {
  const palette = usePalette();
  const open = Math.max(0, CABIN_SEATS.length - taken - (selectedIndex >= taken ? 1 : 0));
  const seat = CABIN_SEATS.find((row) => row.index === selectedIndex);
  return (
    <Text style={{ color: palette.muted }}>
      {seat ? `${seat.label} selected` : "Pick a seat"} · {taken} taken · {open} open
    </Text>
  );
}

export function cabinColour(name?: string) {
  const key = (name || "").toLowerCase();
  if (key.includes("blue")) return "#4F7EB5";
  if (key.includes("black")) return "#2A2A2A";
  if (key.includes("white")) return "#D9D4CB";
  if (key.includes("silver")) return "#9AA3AD";
  return brand.orange === "#FF6A00" ? "#5B7FA8" : "#5B7FA8";
}
