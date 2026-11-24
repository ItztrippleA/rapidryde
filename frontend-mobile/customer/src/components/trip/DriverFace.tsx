import { Text, View } from "react-native";
import { Image } from "expo-image";
import { usePalette } from "../../theme/Theme";

/** Round portrait beside a driver's name. Shows the photo when the ride service sends one. */
export function DriverFace({ name, photo, size = 52 }: { name: string; photo?: string; size?: number }) {
  const palette = usePalette();
  const letter = name.trim().slice(0, 1).toUpperCase() || "D";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: palette.accentSoft,
        borderWidth: 2,
        borderColor: palette.line,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: palette.accent, fontSize: Math.round(size * 0.38), fontWeight: "800" }}>{letter}</Text>
      )}
    </View>
  );
}
