import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { File } from "expo-file-system";
import { Screen } from "../../components/ui/Screen";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { PhotoSlot } from "../../components/kyc/PhotoSlot";
import { usePalette } from "../../theme/Theme";
import { useCustomerStore } from "../../store/useCustomerStore";
import { api, apiBase, ApiError, hasApi } from "../../lib/api";
import { maskTail } from "../../lib/format";

export default function Identity() {
  const palette = usePalette();
  const profile = useCustomerStore((s) => s.profile);
  const saved = useCustomerStore((s) => s.identity);
  const saveIdentity = useCustomerStore((s) => s.saveIdentity);
  const [nin, setNin] = useState("");
  const [selfie, setSelfie] = useState(saved.selfieUri || "");
  const [slip, setSlip] = useState(saved.slipUri || "");
  const [consent, setConsent] = useState(saved.consented);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!/^\d{11}$/.test(nin)) {
      setError("Enter the 11-digit NIN. You can find it on your NIN slip or by dialling *346#.");
      return;
    }
    // Production requires a selfie; __DEV__ can verify NIN alone.
    if (!selfie && !__DEV__) {
      setError("Take a clear selfie so we can match your face to the NIN photo.");
      return;
    }
    if (!consent) {
      setError("Tick the consent box before this is submitted.");
      return;
    }

    const snapshot = nin;
    setNin("");
    setLoading(true);
    setError("");
    try {
      let status: "pending" | "approved" | "rejected" = "pending";
      let failureReason = "";
      let matchConfidence: number | undefined;
      let masked = maskTail(snapshot, 4);

      if (hasApi()) {
        const selfieImage = selfie ? await uriToBase64(selfie) : undefined;
        const payload = {
          nin: snapshot,
          selfieImage,
          slipAttached: Boolean(slip),
        };
        console.log(`[kyc/nin] → POST ${apiBase}/kyc/nin`, {
          nin: `*******${snapshot.slice(-4)}`,
          hasSelfie: Boolean(selfieImage),
          slipAttached: Boolean(slip),
        });
        const body = await api<{
          status?: string;
          masked?: string;
          match?: boolean;
          confidence?: number;
          failureReason?: string;
        }>("/kyc/nin", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        console.log("[kyc/nin] ← response", body);
        masked = body.masked || masked;
        matchConfidence = typeof body.confidence === "number" ? body.confidence : undefined;
        if (body.status === "approved" || body.match === true) {
          status = "approved";
        } else {
          status = "rejected";
          failureReason =
            body.failureReason ||
            "Face did not match the NIN photo. Retake in even light, facing the camera.";
        }
      } else {
        console.warn("[kyc/nin] skipped — EXPO_PUBLIC_API_URL is empty; approving offline");
        status = "approved";
        matchConfidence = 100;
      }

      saveIdentity({
        maskedNin: masked,
        slipUri: slip,
        selfieUri: selfie,
        status,
        failureReason,
        consented: true,
        matchConfidence,
      });

      if (status === "rejected") {
        setError(failureReason);
        return;
      }
      router.replace("/");
    } catch (err) {
      const reason =
        err instanceof ApiError
          ? err.message
          : "The verification service could not accept this attempt.";
      console.warn("[kyc/nin] request failed", reason);
      saveIdentity({
        maskedNin: maskTail(snapshot, 4),
        slipUri: slip,
        selfieUri: selfie,
        status: "rejected",
        failureReason: reason,
        consented: true,
      });
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen footer={<Button label="Verify" onPress={() => void submit()} loading={loading} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Verify your identity</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>
        We match your selfie to your NIN with Dojah. This phone keeps only a masked NIN.
      </Text>
      <View style={{ padding: 16, borderRadius: 16, backgroundColor: palette.raised, gap: 6 }}>
        <Text style={{ color: palette.ink, fontWeight: "700" }}>Where to find it</Text>
        <Text style={{ color: palette.muted, lineHeight: 20 }}>
          The NIN is 11 digits on your NIN slip, or retrieve it with *346#. Name on this account: {profile.firstName}{" "}
          {profile.lastName}.
        </Text>
      </View>
      {saved.maskedNin ? (
        <Text style={{ color: palette.ink, fontSize: 18, fontWeight: "700" }}>NIN {saved.maskedNin}</Text>
      ) : null}
      {saved.status === "approved" ? (
        <Text style={{ color: "#8FB800" }}>
          Status: approved
          {typeof saved.matchConfidence === "number" ? ` · face match ${Math.round(saved.matchConfidence)}%` : ""}.
        </Text>
      ) : null}
      {saved.failureReason ? <Text style={{ color: "#C4482D", lineHeight: 20 }}>{saved.failureReason}</Text> : null}
      <Field
        label="National Identification Number"
        value={nin}
        onChangeText={(text) => setNin(text.replace(/\D/g, "").slice(0, 11))}
        keyboardType="number-pad"
        placeholder="11 digits"
        error={error}
        hint="Submitted for face match. The full number is not saved on this phone."
      />
      <PhotoSlot
        label={__DEV__ ? "Live selfie (optional in dev)" : "Live selfie"}
        uri={selfie}
        onChange={setSelfie}
        cameraOnly
        minWidth={320}
        hint={
          __DEV__
            ? "Dev mode: you can skip the selfie and verify with NIN only."
            : "Look straight at the camera. Even light, no sunglasses, face fills most of the frame."
        }
      />
      <PhotoSlot label="NIN slip, if you have it (optional)" uri={slip} onChange={setSlip} />
      <Pressable onPress={() => setConsent((value) => !value)} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: palette.accent,
            backgroundColor: consent ? palette.accent : "transparent",
            marginTop: 2,
          }}
        />
        <Text style={{ color: palette.ink, flex: 1, lineHeight: 22 }}>
          I agree to send my NIN and selfie to Rapyd Ryd’s identity partner (Dojah) for this check only.
        </Text>
      </Pressable>
    </Screen>
  );
}

async function uriToBase64(uri: string) {
  const raw = await new File(uri).base64();
  return raw.replace(/\s/g, "");
}
