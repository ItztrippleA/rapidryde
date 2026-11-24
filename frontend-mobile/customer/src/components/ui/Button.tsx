import { ActivityIndicator, Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { usePalette } from "../../theme/Theme";

export function Button({
  label,
  onPress,
  disabled,
  loading,
  kind = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: "primary" | "quiet" | "danger";
}) {
  const palette = usePalette();
  const background = kind === "primary" ? palette.accent : kind === "danger" ? "transparent" : palette.paper;
  const color = kind === "primary" ? palette.accentInk : kind === "danger" ? "#C4482D" : palette.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingHorizontal: 18,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
        borderWidth: kind === "primary" ? 0 : 1,
        borderColor: kind === "danger" ? "#C4482D" : palette.line,
        opacity: disabled ? 0.4 : pressed ? 0.86 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontSize: 16, fontWeight: "700" }}>{label}</Text>}
    </Pressable>
  );
}
