import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { useCustomerStore } from "../store/useCustomerStore";
import { naira, whenLabel } from "../lib/format";

export default function Summary() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const trips = useCustomerStore((s) => s.trips);
  const saveReview = useCustomerStore((s) => s.saveReview);
  const trip = (id ? trips.find((item) => item.id === id) : trips[0]) ?? null;
  const [rating, setRating] = useState(trip?.rating ?? 0);
  const [review, setReview] = useState(trip?.review ?? "");
  const [saved, setSaved] = useState(false);
  const fromHistory = Boolean(id);

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace(fromHistory ? "/trips" : "/home");
  }

  if (!trip) {
    return (
      <Screen footer={<Button label="Trips" onPress={() => router.replace("/trips")} />}>
        <Text style={{ color: palette.ink, fontSize: 28, fontWeight: "700" }}>This ride is not on this phone.</Text>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <Pressable onPress={back} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, alignSelf: "flex-start" }}>
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
          <Text style={{ color: palette.ink, fontWeight: "700" }}>Trips</Text>
        </Pressable>
      }
      footer={
        fromHistory ? (
          <Button label={saved ? "Saved" : "Save review"} disabled={rating < 1} onPress={() => { saveReview(trip.id, rating, review); setSaved(true); }} />
        ) : (
          <Button label="Done" disabled={rating < 1} onPress={() => { saveReview(trip.id, rating, review); router.replace("/trips"); }} />
        )
      }
    >
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>{trip.stage === "completed" ? "Trip complete" : "Ride"}</Text>
      <Text style={{ color: palette.muted }}>{trip.pickup.label} → {trip.dropoff.label}</Text>
      {trip.stops.map((stop) => (
        <Text key={stop.id} style={{ color: palette.muted }}>Stop · {stop.label}</Text>
      ))}
      <Text style={{ color: palette.ink, fontSize: 28, fontWeight: "700" }}>{trip.stage === "completed" ? naira(trip.fare) : "No fare"}</Text>
      <Text style={{ color: palette.muted }}>
        {trip.classLabel} · {trip.payment} · {whenLabel(trip.endedAt || trip.startedAt)}
        {trip.driver ? ` · ${trip.driver.name}` : ""}
      </Text>
      <Text style={{ color: palette.muted }}>Fare {naira(trip.fare)}.</Text>
      {trip.stage === "completed" ? (
        <>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>Rate this trip</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} accessibilityLabel={`${star} stars`} onPress={() => { setRating(star); setSaved(false); }}>
                <Ionicons name={star <= rating ? "star" : "star-outline"} size={28} color={palette.accent} />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={review}
            onChangeText={(value) => { setReview(value); setSaved(false); }}
            placeholder="How was this trip?"
            placeholderTextColor={palette.muted}
            multiline
            style={{ minHeight: 90, borderRadius: 14, padding: 12, color: palette.ink, backgroundColor: palette.raised }}
          />
        </>
      ) : (
        <Text style={{ color: palette.muted }}>{trip.stage === "cancelled" ? "This ride was cancelled." : "This ride did not finish."}</Text>
      )}
    </Screen>
  );
}
