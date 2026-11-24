import { useEffect, useMemo } from "react";
import { ThemeProvider as NavigationThemeProvider, router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { usePalette } from "../../theme/Theme";
import { useCustomerStore } from "../../store/useCustomerStore";
import { refreshSession } from "../../lib/session";
import { iosMajorVersion, navigationTheme, tabBarSurface, tabLabel, tabTint } from "../../lib/nativeTabs";

export default function AppTabs() {
  const palette = usePalette();
  const signOut = useCustomerStore((s) => s.signOut);
  const theme = useMemo(() => navigationTheme(palette), [palette]);
  const tint = useMemo(() => tabTint(palette), [palette]);
  const label = useMemo(() => tabLabel(palette), [palette]);
  const surface = useMemo(() => tabBarSurface(palette), [palette]);

  useEffect(() => {
    void refreshSession()
      .then((ok) => {
        if (!ok) {
          signOut();
          router.replace("/welcome");
        }
      })
      .catch(() => undefined);
  }, [signOut]);

  return (
    <NavigationThemeProvider value={theme}>
      <NativeTabs
        preferredPlacement="automatic"
        tintColor={tint}
        iconColor={{ default: label, selected: tint }}
        labelStyle={{
          default: { color: label, fontSize: 10, fontWeight: "600" },
          selected: { color: tint, fontSize: 10, fontWeight: "600" },
        }}
        {...surface}
        {...(iosMajorVersion() >= 26 ? { minimizeBehavior: "automatic" as const } : null)}
      >
        <NativeTabs.Trigger name="home" contentStyle={{ backgroundColor: palette.bg }}>
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="trips" contentStyle={{ backgroundColor: palette.bg }}>
          <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "clock", selected: "clock.fill" }} md="schedule" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="wallet" contentStyle={{ backgroundColor: palette.bg }}>
          <NativeTabs.Trigger.Label>Wallet</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "creditcard", selected: "creditcard.fill" }}
            md="account_balance_wallet"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="support" contentStyle={{ backgroundColor: palette.bg }}>
          <NativeTabs.Trigger.Label>Support</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }}
            md="chat"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </NavigationThemeProvider>
  );
}
