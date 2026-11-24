import { Linking, Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";

const supportPhone = "+2347007293743";

export default function Safety() {
  const palette = usePalette();
  return (
    <Screen footer={<Button label="Back" kind="quiet" onPress={() => router.back()} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Safety</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>Share a trip from the ride screen. The share text leaves out your pickup PIN.</Text>
      <Text style={{ color: palette.ink, fontWeight: "700" }}>Emergency</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>SOS reaches Rapyd Ryd support, and local emergency services if you call them yourself.</Text>
      <Button label="Call support" onPress={() => void Linking.openURL(`tel:${supportPhone}`)} />
      <Button label="Message support" kind="quiet" onPress={() => router.push("/support")} />
      <Text style={{ color: palette.muted }}>care@rapydryd.com</Text>
    </Screen>
  );
}
