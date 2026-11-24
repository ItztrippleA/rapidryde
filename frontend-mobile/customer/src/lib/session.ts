import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN = "rapyd.customer.token";
const REFRESH = "rapyd.customer.refresh";
const PIN = "rapyd.customer.pin";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    sessionStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === "web") return sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    sessionStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readToken() {
  return getItem(TOKEN);
}

export async function saveSession(token: string, refresh: string) {
  await setItem(TOKEN, token);
  await setItem(REFRESH, refresh);
}

export async function clearSession() {
  await deleteItem(TOKEN);
  await deleteItem(REFRESH);
}

export async function clearAccount() {
  await clearSession();
  await deleteItem(PIN);
}

export async function saveTripPin(pin: string) {
  await setItem(PIN, pin);
}

export async function readTripPin() {
  return getItem(PIN);
}

export async function clearTripPin() {
  await deleteItem(PIN);
}

export async function refreshSession() {
  const refresh = await getItem(REFRESH);
  if (!refresh) return false;
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    await saveSession(`local.${Date.now().toString(36)}`, refresh);
    return true;
  }
  const response = await fetch(`${base}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { token?: string; refresh?: string };
  if (!body.token || !body.refresh) return false;
  await saveSession(body.token, body.refresh);
  return true;
}
