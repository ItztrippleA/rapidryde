import { useState } from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { formatNigerian, normalizeNigerian } from "../../lib/phone";
import { useCustomerStore } from "../../store/useCustomerStore";
import { api, ApiError, hasApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { uid } from "../../lib/format";

export default function Login() {
  const palette = usePalette();
  const known = useCustomerStore((s) => s.phone);
  const completeAuth = useCustomerStore((s) => s.completeAuth);
  const [phone, setPhone] = useState(known || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    const typed = phone.trim();
    const normalised = normalizeNigerian(phone);
    if (hasApi()) {
      if (!normalised) {
        setError("Enter a Nigerian mobile number.");
        return;
      }
      if (password.length < 8) {
        setError("Enter your password.");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      if (hasApi()) {
        const body = await api<{
          token: string;
          refresh: string;
          user?: {
            publicCode?: string | null;
            identity?: {
              maskedNin?: string | null;
              status?: string | null;
              failureReason?: string | null;
              matchConfidence?: number | null;
              consented?: boolean;
            } | null;
          };
        }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ phone: normalised, password, role: "customer" }),
        });
        await saveSession(body.token, body.refresh);
        completeAuth(normalised ?? typed, undefined, { publicCode: body.user?.publicCode ?? undefined });
        const remote = body.user?.identity;
        if (remote?.status === "approved" || remote?.status === "rejected" || remote?.status === "pending") {
          useCustomerStore.getState().saveIdentity({
            maskedNin: remote.maskedNin || "",
            selfieUri: "",
            slipUri: "",
            status: remote.status,
            failureReason: remote.failureReason || "",
            consented: Boolean(remote.consented),
            matchConfidence: typeof remote.matchConfidence === "number" ? remote.matchConfidence : undefined,
          });
        }
      } else {
        await saveSession(uid("tok"), uid("ref"));
        completeAuth(typed || "preview");
        useCustomerStore.getState().saveIdentity({
          maskedNin: "*******0000",
          selfieUri: "",
          slipUri: "",
          status: "approved",
          failureReason: "",
          consented: true,
          matchConfidence: 100,
        });
      }
      router.replace("/");
    } catch (err) {
      const expired = err instanceof ApiError && err.status === 401;
      setError(expired ? "That sign-in expired. Try again." : err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Sign in" onPress={() => void signIn()} loading={loading} />
          <Button label="Create an account" kind="quiet" onPress={() => router.push("/signup")} />
        </>
      }
    >
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Welcome back</Text>
      <Text style={{ color: palette.muted, fontSize: 16, lineHeight: 24 }}>
        Sign in with your mobile number.
      </Text>
      <Field label="Mobile number" value={phone} onChangeText={(text) => setPhone(hasApi() ? formatNigerian(text) : text)} keyboardType={hasApi() ? "phone-pad" : "default"} autoCapitalize="none" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" error={error} />
      <Pressable onPress={() => router.push("/forgot")} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: palette.accent, fontWeight: "700" }}>Forgot password</Text>
      </Pressable>
    </Screen>
  );
}
