import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { api, ApiError, hasApi } from "../../lib/api";
import { authDraft, clearAuthDraft } from "../../lib/authDraft";
import { saveSession } from "../../lib/session";
import { useCustomerStore } from "../../store/useCustomerStore";
import { uid } from "../../lib/format";

export default function Reset() {
  const palette = usePalette();
  const completeAuth = useCustomerStore((s) => s.completeAuth);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (hasApi() ? password.length < 8 : !password.trim()) {
      setError("Use at least 8 characters.");
      return;
    }
    if (hasApi() && !authDraft.verificationToken) {
      setError("Verify the code first.");
      router.replace("/forgot");
      return;
    }
    setLoading(true);
    try {
      if (hasApi()) {
        const body = await api<{ token: string; refresh: string }>("/auth/reset", {
          method: "POST",
          body: JSON.stringify({
            phone: authDraft.phone,
            password,
            verificationToken: authDraft.verificationToken,
            role: "customer",
          }),
        });
        await saveSession(body.token, body.refresh);
      } else {
        await saveSession(uid("tok"), uid("ref"));
      }
      completeAuth(authDraft.phone);
      clearAuthDraft();
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The password was not saved.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen footer={<Button label="Save password" onPress={() => void save()} loading={loading} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>New password</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>This replaces the password on {authDraft.phone || "your account"}.</Text>
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" error={error} />
    </Screen>
  );
}
