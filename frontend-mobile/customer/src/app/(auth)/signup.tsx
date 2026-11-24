import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Screen } from "../../components/ui/Screen";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { usePalette } from "../../theme/Theme";
import { formatNigerian, normalizeNigerian } from "../../lib/phone";
import { api, ApiError, hasApi } from "../../lib/api";
import { authDraft } from "../../lib/authDraft";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name."),
  lastName: z.string().trim().min(1, "Enter your last name."),
  phone: z.string().refine((value) => Boolean(normalizeNigerian(value)), "Enter a Nigerian mobile number."),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().refine((value) => (hasApi() ? value.length >= 8 : value.trim().length > 0), "Enter a password."),
  referral: z.string().trim().optional(),
});

type Form = z.infer<typeof schema>;

export default function Signup() {
  const palette = usePalette();
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", phone: "+234 ", email: "", password: "", referral: "" },
  });

  async function next(values: Form) {
    const phone = normalizeNigerian(values.phone);
    if (!phone) {
      setFormError("Enter a Nigerian mobile number.");
      return;
    }
    authDraft.mode = "signup";
    authDraft.firstName = values.firstName.trim();
    authDraft.lastName = values.lastName.trim();
    authDraft.phone = phone;
    authDraft.email = values.email.trim();
    authDraft.password = values.password;
    authDraft.referral = values.referral?.trim() ?? "";
    authDraft.verificationToken = "";

    setLoading(true);
    setFormError("");
    try {
      if (hasApi()) {
        const otp = await api<{ code?: string }>("/auth/otp", {
          method: "POST",
          body: JSON.stringify({
            phone,
            purpose: "register",
            email: authDraft.email,
          }),
        });
        if (__DEV__ && otp.code) {
          console.log("[auth/otp] dev code", otp.code);
        }
      }
      router.push("/otp");
    } catch (err) {
      console.error("[auth/otp] send failed", err);
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Check your connection and try again.";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen footer={<Button label="Send code" onPress={handleSubmit(next)} loading={loading} />}>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>Create your account</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>
        We text a 6-digit code to this number.
      </Text>
      <Controller control={control} name="firstName" render={({ field, fieldState }) => <Field label="First name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="words" />} />
      <Controller control={control} name="lastName" render={({ field, fieldState }) => <Field label="Last name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="words" />} />
      <Controller control={control} name="phone" render={({ field, fieldState }) => <Field label="Mobile number" value={field.value} onChangeText={(text) => field.onChange(formatNigerian(text))} error={fieldState.error?.message} keyboardType="phone-pad" autoCapitalize="none" />} />
      <Controller control={control} name="email" render={({ field, fieldState }) => <Field label="Email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} keyboardType="email-address" autoCapitalize="none" />} />
      <Controller control={control} name="password" render={({ field, fieldState }) => <Field label="Password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} secureTextEntry autoCapitalize="none" />} />
      <Controller control={control} name="referral" render={({ field }) => <Field label="Referral code" value={field.value ?? ""} onChangeText={field.onChange} hint="Optional." autoCapitalize="characters" />} />
      {formError ? <Text style={{ color: "#C4482D", lineHeight: 20 }}>{formError}</Text> : null}
    </Screen>
  );
}
