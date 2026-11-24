import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { OtpInput } from "../../components/ui/OtpInput";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { authDraft, clearAuthDraft } from "../../lib/authDraft";
import { api, ApiError, hasApi } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { useCustomerStore } from "../../store/useCustomerStore";
import { uid } from "../../lib/format";

export default function Otp() {
  const palette = usePalette();
  const completeAuth = useCustomerStore((s) => s.completeAuth);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(30);
  const [note, setNote] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  async function verify(nextCode = code) {
    const digits = nextCode.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      const purpose = authDraft.mode === "reset" ? "reset" : "register";
      if (hasApi()) {
        const verified = await api<{ verificationToken: string }>("/auth/otp/verify", {
          method: "POST",
          body: JSON.stringify({ phone: authDraft.phone, code: digits, purpose }),
        });
        authDraft.verificationToken = verified.verificationToken;

        if (purpose === "reset") {
          router.replace("/reset");
          return;
        }

        const body = await api<{ token: string; refresh: string; user?: { publicCode?: string | null } }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            phone: authDraft.phone,
            password: authDraft.password,
            role: "customer",
            verificationToken: authDraft.verificationToken,
            firstName: authDraft.firstName,
            lastName: authDraft.lastName,
            email: authDraft.email,
            referral: authDraft.referral,
            name: `${authDraft.firstName} ${authDraft.lastName}`.trim(),
          }),
        });
        await saveSession(body.token, body.refresh);
        completeAuth(
          authDraft.phone,
          {
            firstName: authDraft.firstName,
            lastName: authDraft.lastName,
            email: authDraft.email,
            referral: authDraft.referral,
          },
          { publicCode: body.user?.publicCode ?? undefined },
        );
      } else {
        await saveSession(uid("tok"), uid("ref"));
        completeAuth(authDraft.phone, {
          firstName: authDraft.firstName,
          lastName: authDraft.lastName,
          email: authDraft.email,
          referral: authDraft.referral,
        });
      }
      clearAuthDraft();
      router.replace("/identity");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message === "Invalid code" || /invalid code/i.test(err.message)
            ? "That code is wrong. Check the email and try again."
            : err.message === "SESSION"
              ? "Sign-in expired. Go back and request a new code."
              : err.message
          : "The code was not accepted.";
      setError(message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function resend() {
    if (left > 0) return;
    setLeft(30);
    setNote("Another code is on the way.");
    setCode("");
    setError("");
    if (hasApi() && authDraft.phone) {
      try {
        const body = await api<{ code?: string }>("/auth/otp", {
          method: "POST",
          body: JSON.stringify({
            phone: authDraft.phone,
            purpose: authDraft.mode === "reset" ? "reset" : "register",
            email: authDraft.email || undefined,
          }),
        });
        if (__DEV__ && body.code) {
          setNote(`Dev code: ${body.code}`);
        }
      } catch {
        setNote("Could not resend yet. Try again shortly.");
      }
    }
  }

  return (
    <Screen footer={<Button label="Continue" onPress={() => void verify()} loading={loading} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Enter the code</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>
        Sent to {authDraft.email || authDraft.phone || "your inbox"}.
      </Text>
      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(digits) => void verify(digits)}
        error={error}
      />
      <Pressable onPress={() => void resend()} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: left > 0 ? palette.muted : palette.accent, fontWeight: "700" }}>
          {left > 0 ? `Resend in ${left}s` : "Resend code"}
        </Text>
      </Pressable>
      {note ? <Text style={{ color: palette.muted }}>{note}</Text> : null}
    </Screen>
  );
}
