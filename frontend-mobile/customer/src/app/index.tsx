import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Logo } from "../components/ui/Logo";
import { useCustomerStore } from "../store/useCustomerStore";
import { hasApi } from "../lib/api";

export default function Index() {
  const hydrated = useCustomerStore((s) => s.hydrated);
  const onboarded = useCustomerStore((s) => s.onboarded);
  const hasSession = useCustomerStore((s) => s.hasSession);
  const identityStatus = useCustomerStore((s) => s.identity.status);

  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }
    if (!hasSession) {
      router.replace("/welcome");
      return;
    }
    if (hasApi() && identityStatus !== "approved") {
      router.replace("/identity");
      return;
    }
    router.replace("/home");
  }, [hasSession, hydrated, identityStatus, onboarded]);

  return (
    <View style={{ flex: 1, backgroundColor: "#070707", alignItems: "center", justifyContent: "center" }}>
      <Logo width={210} tone="onDark" />
    </View>
  );
}
