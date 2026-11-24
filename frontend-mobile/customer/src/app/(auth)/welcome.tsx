import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Logo } from "../../components/ui/Logo";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { hasApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { uid } from "../../lib/format";
import { useCustomerStore } from "../../store/useCustomerStore";

export default function Welcome() {
  const palette = usePalette();

  async function enter() {
    await saveSession(uid("tok"), uid("ref"));
    useCustomerStore.getState().setOnboarded();
    useCustomerStore.getState().completeAuth("preview");
    useCustomerStore.getState().saveIdentity({
      maskedNin: "*******0000",
      selfieUri: "",
      slipUri: "",
      status: "approved",
      failureReason: "",
      consented: true,
      matchConfidence: 100,
    });
    router.replace("/home");
  }

  return (
    <Screen
      scroll={false}
      footer={
        <>
          {hasApi() ? null : <Button label="Continue" onPress={() => void enter()} />}
          <Button label="Create an account" kind={hasApi() ? "primary" : "quiet"} onPress={() => router.push("/signup")} />
          <Button label="Sign in" kind="quiet" onPress={() => router.push("/login")} />
        </>
      }
    >
      <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <Logo width={200} />
        <Text style={{ color: palette.ink, fontSize: 36, lineHeight: 42, fontWeight: "700" }}>Book a Rapyd Ryd.</Text>
        <Text style={{ color: palette.muted, fontSize: 17, lineHeight: 26 }}>
          Same brand as the driver app. You set the trip, see the fare, and follow the car.
        </Text>
      </View>
    </Screen>
  );
}
