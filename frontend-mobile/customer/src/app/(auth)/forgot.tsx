import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { formatNigerian, normalizeNigerian } from "../../lib/phone";
import { api, ApiError, hasApi } from "../../lib/api";
import { authDraft } from "../../lib/authDraft";

export default function Forgot() {
  const palette = usePalette();
  const [phone, setPhone] = useState("+234 ");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const normalised = normalizeNigerian(phone);
    if (!normalised) {
      setError("Enter the Nigerian mobile number on the account.");
      return;
    }
    authDraft.mode = "reset";
    authDraft.phone = normalised;
    authDraft.verificationToken = "";
    setLoading(true);
    setError("");
    try {
      if (hasApi()) {
        await api("/auth/otp", {
          method: "POST",
          body: JSON.stringify({ phone: normalised, purpose: "reset" }),
        });
      }
      router.push("/otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen footer={<Button label="Send code" onPress={() => void send()} loading={loading} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Reset password</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>We send a 6-digit code to this number.</Text>
      <Field label="Mobile number" value={phone} onChangeText={(text) => setPhone(formatNigerian(text))} keyboardType="phone-pad" autoCapitalize="none" error={error} />
    </Screen>
  );
}
