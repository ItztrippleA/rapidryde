import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, usePalette } from "../theme/Theme";
import { useCustomerStore } from "../store/useCustomerStore";
import { quietAnimatedWarn } from "../lib/ignoreRnNoise";
import { readToken } from "../lib/session";
import { hydratePricingFromApi } from "../lib/fare";
import { startCustomerShell } from "../services/device";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
quietAnimatedWarn();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [secureReady, setSecureReady] = useState(false);
  const hydrated = useCustomerStore((s) => s.hydrated);

  useEffect(() => {
    quietAnimatedWarn();
    // Expo/LogBox sometimes rebinds console.warn after boot — re-wrap a few times.
    const quietTimers = [400, 1200, 3000].map((ms) => setTimeout(quietAnimatedWarn, ms));
    void useCustomerStore.persist.rehydrate().finally(() => useCustomerStore.getState().setHydrated(true));
    void readToken().then((token) => {
      useCustomerStore.getState().setHasSession(Boolean(token));
      setSecureReady(true);
      if (token) {
        void import("../lib/seedPickup").then(({ seedPickupFromGps }) => seedPickupFromGps());
      }
    });
    void startCustomerShell();
    void hydratePricingFromApi();
    return () => quietTimers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (hydrated && secureReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated, secureReady]);

  if (!hydrated || !secureReady) {
    return <View style={{ flex: 1, backgroundColor: "#070707" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Routed />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Routed() {
  const palette = usePalette();
  return (
    <>
      <StatusBar style={palette.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="book" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="matching" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}
