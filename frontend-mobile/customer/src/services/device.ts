import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import PostHog from "posthog-react-native";
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { useCustomerStore } from "../store/useCustomerStore";

const oneSignalAppId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "";
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let started = false;

function projectId() {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || "";
}

export async function startCustomerShell() {
  if (started || Platform.OS === "web") return;
  started = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.requestPermissionsAsync().catch(() => undefined);
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("trips", {
      name: "Trips",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#E2B657",
    }).catch(() => undefined);
  }
  const id = projectId();
  if (id) await Notifications.getExpoPushTokenAsync({ projectId: id }).catch(() => undefined);
  const oneSignalReady = (() => {
    try {
      return TurboModuleRegistry.get("OneSignal") != null || NativeModules.OneSignal != null;
    } catch {
      return false;
    }
  })();
  if (oneSignalAppId && oneSignalReady) {
    try {
      const { OneSignal } = await import("react-native-onesignal");
      OneSignal.initialize(oneSignalAppId);
      OneSignal.User.addTag("role", "customer");
      await OneSignal.Notifications.requestPermission(true);
    } catch {
      /* native module missing */
    }
  }
  if (posthogKey) {
    const posthog = new PostHog(posthogKey, { host: posthogHost, captureAppLifecycleEvents: true, enableSessionReplay: false });
    posthog.capture("customer_opened");
  }
  useCustomerStore.getState().setShell({
    push: oneSignalAppId && oneSignalReady ? "onesignal" : "local",
    analytics: posthogKey ? "posthog" : "off",
  });
}

export async function remindPickup(at: number, label: string) {
  if (Platform.OS === "web") return;
  const when = new Date(at - 30 * 60 * 1000);
  if (when.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Pickup coming up", body: label, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  }).catch(() => undefined);
}
