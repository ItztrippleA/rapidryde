import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/ui/Screen";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Rise } from "../components/ui/Rise";
import { usePalette } from "../theme/Theme";
import { displayName, useCustomerStore } from "../store/useCustomerStore";
import { clearAccount } from "../lib/session";
import { api, ApiError, hasApi } from "../lib/api";
import { stopRide } from "../services/realtime";

export default function Account() {
  const palette = usePalette();
  const profile = useCustomerStore((s) => s.profile);
  const phone = useCustomerStore((s) => s.phone);
  const publicCode = useCustomerStore((s) => s.publicCode);
  const identity = useCustomerStore((s) => s.identity);
  const mode = useCustomerStore((s) => s.mode);
  const setMode = useCustomerStore((s) => s.setMode);
  const saveProfile = useCustomerStore((s) => s.saveProfile);
  const home = useCustomerStore((s) => s.home);
  const work = useCustomerStore((s) => s.work);
  const saved = useCustomerStore((s) => s.saved);
  const removeSaved = useCustomerStore((s) => s.removeSaved);
  const signOut = useCustomerStore((s) => s.signOut);
  const replayOnboarding = useCustomerStore((s) => s.replayOnboarding);
  const deleteLocal = useCustomerStore((s) => s.deleteLocal);
  const [first, setFirst] = useState(profile.firstName);
  const [last, setLast] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [confirm, setConfirm] = useState<"out" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function photo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0])
      saveProfile({ photo: result.assets[0].uri });
  }

  function save() {
    saveProfile({
      firstName: first.trim(),
      lastName: last.trim(),
      email: email.trim(),
    });
  }

  async function removeAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      if (hasApi()) await api("/auth/account", { method: "DELETE" });
      stopRide();
      await clearAccount();
      deleteLocal();
      router.replace("/welcome");
    } catch (error) {
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : "Could not delete this account. Try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function leave() {
    stopRide();
    await clearAccount();
    signOut();
    router.replace("/welcome");
  }

  return (
    <Screen>
      <Rise>
        <Pressable
          onPress={() => router.back()}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: palette.accent, fontWeight: "700" }}>Back</Text>
        </Pressable>
      </Rise>
      <Rise index={1} style={{ alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => void photo()}
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: palette.accentSoft,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {profile.photo ? (
            <Image
              source={{ uri: profile.photo }}
              style={{ width: 88, height: 88 }}
            />
          ) : (
            <Text
              style={{ color: palette.accent, fontSize: 32, fontWeight: "800" }}
            >
              {displayName(profile).slice(0, 1)}
            </Text>
          )}
        </Pressable>
        <Text style={{ color: palette.ink, fontSize: 28, fontWeight: "800" }}>
          {displayName({ ...profile, firstName: first, lastName: last })}
        </Text>
        {publicCode ? (
          <Text
            style={{
              color: palette.ink,
              fontWeight: "700",
              letterSpacing: 0.6,
            }}
          >
            {publicCode}
          </Text>
        ) : null}
        <Text style={{ color: palette.muted }}>
          {phone === "preview"
            ? "Signed in on this phone"
            : phone || "No mobile number yet"}
        </Text>
        {identity.maskedNin ? (
          <Text style={{ color: palette.muted }}>
            {/* NIN {identity.maskedNin} */}
            {identity.status === "approved"
              ? typeof identity.matchConfidence === "number"
                ? ` · verified · face ${Math.round(identity.matchConfidence)}%`
                : " · verified"
              : ` · ${identity.status}`}
          </Text>
        ) : (
          <Pressable
            onPress={() => router.push("/identity")}
            style={{ minHeight: 36, justifyContent: "center" }}
          >
            <Text style={{ color: palette.accent, fontWeight: "700" }}>
              Verify NIN & face
            </Text>
          </Pressable>
        )}
      </Rise>
      <Rise index={2} style={{ gap: 12 }}>
        <Field
          label="First name"
          value={first}
          onChangeText={setFirst}
          autoCapitalize="words"
        />
        <Field
          label="Last name"
          value={last}
          onChangeText={setLast}
          autoCapitalize="words"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@email.com"
        />
        <Button label="Save profile" onPress={save} />
      </Rise>
      <Rise index={3} style={{ gap: 8 }}>
        <Text style={{ color: palette.ink, fontSize: 18, fontWeight: "800" }}>
          Places
        </Text>
        <PlaceRow
          label="Home"
          value={home?.label || "Add home"}
          onPress={() => router.push("/search?target=home")}
        />
        <PlaceRow
          label="Work"
          value={work?.label || "Add work"}
          onPress={() => router.push("/search?target=work")}
        />
        {saved.map((place) => (
          <View
            key={place.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View style={{ flex: 1 }}>
              <PlaceRow
                label="Saved"
                value={place.label}
                onPress={() => router.push("/search?target=dropoff")}
              />
            </View>
            <Pressable
              onPress={() => removeSaved(place.id)}
              style={{
                width: 36,
                height: 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={palette.muted} />
            </Pressable>
          </View>
        ))}
      </Rise>
      <Rise index={4}>
        <Pressable
          onPress={() => setMode(mode === "dark" ? "light" : "dark")}
          style={{
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: palette.ink, fontWeight: "700" }}>
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </Text>
          <Ionicons
            name={mode === "dark" ? "sunny-outline" : "moon-outline"}
            size={20}
            color={palette.ink}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push("/safety")}
          style={{ minHeight: 52, justifyContent: "center" }}
        >
          <Text style={{ color: palette.ink, fontWeight: "700" }}>Safety</Text>
        </Pressable>
      </Rise>
      <Rise index={5} style={{ gap: 10, paddingTop: 4 }}>
        <Button
          label="See onboarding again"
          kind="quiet"
          onPress={() => {
            replayOnboarding();
            router.replace("/onboarding");
          }}
        />
        {confirm === "out" ? (
          <Confirm
            title="Sign out of this phone?"
            body="You will need your password next time. Trips on this phone stay until you sign back in."
            action="Sign out"
            cancel="Stay signed in"
            onAction={() => void leave()}
            onCancel={() => setConfirm(null)}
          />
        ) : (
          <Button
            label="Sign out"
            kind="quiet"
            onPress={() => setConfirm("out")}
          />
        )}
        {confirm === "delete" ? (
          <Confirm
            title={
              hasApi()
                ? "Delete your Rapyd Ryd account?"
                : "Delete account on this phone?"
            }
            body={
              hasApi()
                ? "This permanently removes your account, NIN verification, and sign-in. Past trip records may stay for support. You cannot undo this."
                : "Your profile, places, trips, and wallet on this phone are cleared. Sign-in starts over."
            }
            error={deleteError}
            action="Delete account"
            cancel="Keep account"
            loading={deleting}
            onAction={() => void removeAccount()}
            onCancel={() => {
              setConfirm(null);
              setDeleteError("");
            }}
          />
        ) : (
          <Button
            label="Delete account"
            kind="danger"
            onPress={() => setConfirm("delete")}
          />
        )}
      </Rise>
    </Screen>
  );
}

function Confirm({
  title,
  body,
  error,
  action,
  cancel,
  loading,
  onAction,
  onCancel,
}: {
  title: string;
  body: string;
  error?: string;
  action: string;
  cancel: string;
  loading?: boolean;
  onAction: () => void;
  onCancel: () => void;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        gap: 10,
        padding: 16,
        borderRadius: 16,
        backgroundColor: palette.raised,
      }}
    >
      <Text style={{ color: palette.ink, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: palette.muted, lineHeight: 20 }}>{body}</Text>
      {error ? (
        <Text style={{ color: "#C4482D", lineHeight: 20 }}>{error}</Text>
      ) : null}
      <Button
        label={action}
        kind="danger"
        loading={loading}
        onPress={onAction}
      />
      <Button
        label={cancel}
        kind="quiet"
        onPress={onCancel}
        disabled={loading}
      />
    </View>
  );
}

function PlaceRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 56,
        borderRadius: 16,
        paddingHorizontal: 14,
        backgroundColor: palette.paper,
        borderWidth: 1,
        borderColor: palette.line,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: palette.ink, fontWeight: "700" }} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}
