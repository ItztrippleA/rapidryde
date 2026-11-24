import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { usePalette } from "../../theme/Theme";

export function PhotoSlot({
  label,
  uri,
  onChange,
  cameraOnly,
  minWidth = 500,
  hint,
}: {
  label: string;
  uri: string;
  onChange: (uri: string) => void;
  cameraOnly?: boolean;
  minWidth?: number;
  hint?: string;
}) {
  const palette = usePalette();
  const [note, setNote] = useState("");

  async function pick(camera: boolean) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNote(camera ? "Camera permission is off." : "Photo library permission is off.");
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
          cameraType: cameraOnly ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, mediaTypes: ["images"] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const width = asset.width ?? 0;
    if (width > 0 && width < minWidth) {
      setNote(
        cameraOnly
          ? "That selfie is too small. Retake facing the camera in even light."
          : "That photo is too small. Retake it in even light, with the whole document in frame.",
      );
      return;
    }
    setNote("");
    onChange(asset.uri);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: palette.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: 160, borderRadius: 14, backgroundColor: palette.raised }} />
      ) : (
        <View
          style={{
            height: 120,
            borderRadius: 14,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: palette.line,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.raised,
          }}
        >
          <Text style={{ color: palette.muted }}>No photo yet</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => void pick(true)} style={pill(palette.paper, palette.line)}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>{uri ? "Retake" : cameraOnly ? "Take selfie" : "Camera"}</Text>
        </Pressable>
        {cameraOnly ? null : (
          <Pressable onPress={() => void pick(false)} style={pill(palette.paper, palette.line)}>
            <Text style={{ color: palette.ink, fontWeight: "700" }}>Upload</Text>
          </Pressable>
        )}
      </View>
      {hint ? <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 18 }}>{hint}</Text> : null}
      {note ? <Text style={{ color: "#C4482D", fontSize: 13 }}>{note}</Text> : null}
    </View>
  );
}

function pill(backgroundColor: string, borderColor: string) {
  return {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor,
    borderWidth: 1,
    borderColor,
  };
}
