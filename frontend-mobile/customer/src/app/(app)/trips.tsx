import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/ui/Screen";
import { Rise } from "../../components/ui/Rise";
import { usePalette } from "../../theme/Theme";
import { useCustomerStore, type CustomerTrip } from "../../store/useCustomerStore";
import { naira, whenLabel } from "../../lib/format";
import { backfillGenericPlaceLabels, isGenericPlaceLabel } from "../../lib/places";

export default function Trips() {
  const palette = usePalette();
  const trips = useCustomerStore((s) => s.trips);
  const scheduled = useCustomerStore((s) => s.scheduled);
  const trip = useCustomerStore((s) => s.trip);
  const recent = useCustomerStore((s) => s.recent);
  const startTrip = useCustomerStore((s) => s.startTrip);
  const history = [...trips].sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt));
  const upcoming = scheduled.filter((item) => item.stage !== "cancelled" && item.stage !== "completed");

  useEffect(() => {
    let alive = true;
    const state = useCustomerStore.getState();
    const needsWork =
      state.trips.some((item) => isGenericPlaceLabel(item.pickup.label) || isGenericPlaceLabel(item.dropoff.label)) ||
      state.scheduled.some((item) => isGenericPlaceLabel(item.pickup.label) || isGenericPlaceLabel(item.dropoff.label)) ||
      state.recent.some((place) => isGenericPlaceLabel(place.label)) ||
      (state.trip != null && (isGenericPlaceLabel(state.trip.pickup.label) || isGenericPlaceLabel(state.trip.dropoff.label)));
    if (!needsWork) return;
    void backfillGenericPlaceLabels({
      trips: state.trips,
      recent: state.recent,
      scheduled: state.scheduled,
      trip: state.trip,
    }).then((next) => {
      if (!alive) return;
      useCustomerStore.setState({
        ...(next.trips ? { trips: next.trips as CustomerTrip[] } : {}),
        ...(next.recent ? { recent: next.recent } : {}),
        ...(next.scheduled ? { scheduled: next.scheduled as CustomerTrip[] } : {}),
        ...(next.trip !== undefined ? { trip: next.trip as CustomerTrip | null } : {}),
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen>
      <Rise>
        <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "800" }}>YOUR RIDES</Text>
        <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "800" }}>Trips</Text>
        <Text style={{ color: palette.muted, lineHeight: 22 }}>Open a ride for the route, fare, and review.</Text>
      </Rise>
      {trip ? (
        <Pressable onPress={() => router.push(trip.stage === "searching" ? "/matching" : "/trip")} style={card(palette.paper, palette.line)}>
          <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>ON A RIDE NOW</Text>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>{placeLine(trip.pickup.label)} → {placeLine(trip.dropoff.label)}</Text>
          <Text style={{ color: palette.muted }}>{trip.driver?.name || "Finding a driver"}</Text>
        </Pressable>
      ) : null}
      {history.length === 0 ? (
        <Text style={{ color: palette.muted, fontSize: 16, lineHeight: 24 }}>No rides yet.</Text>
      ) : (
        history.map((item) => (
          <View key={`${item.id}-${item.endedAt}`} style={card(palette.paper, palette.line)}>
            <Pressable onPress={() => router.push({ pathname: "/summary", params: { id: item.id } })} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: palette.ink, fontWeight: "700" }}>{placeLine(item.pickup.label)} → {placeLine(item.dropoff.label)}</Text>
                <Text style={{ color: palette.muted }}>{stageLabel(item)} · {item.classLabel}</Text>
                <Text style={{ color: palette.ink }}>{item.stage === "completed" ? naira(item.fare) : "No fare"} · {whenLabel(item.endedAt || item.startedAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </Pressable>
            <Pressable
              onPress={() => {
                startTrip(item.dropoff, item.pickup);
                router.push("/book");
              }}
              style={{ marginTop: 10, minHeight: 40, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: palette.accentInk, fontWeight: "800" }}>Book this destination</Text>
            </Pressable>
          </View>
        ))
      )}
      {upcoming.length ? <Text style={{ color: palette.ink, fontWeight: "700" }}>Scheduled</Text> : null}
      {upcoming.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: "/schedule", params: { id: item.id } })} style={card(palette.paper, palette.line)}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>{placeLine(item.pickup.label)} → {placeLine(item.dropoff.label)}</Text>
          <Text style={{ color: palette.muted }}>{item.scheduledAt ? whenLabel(item.scheduledAt) : "Time not set"}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

function placeLine(label?: string | null) {
  if (isGenericPlaceLabel(label)) return "Finding place…";
  return label || "Place";
}

function stageLabel(item: CustomerTrip) {
  if (item.stage === "completed") return "Completed";
  if (item.stage === "cancelled") return "Cancelled";
  if (item.stage === "timeout") return "Search timed out";
  if (item.stage === "no_drivers") return "No driver";
  if (item.stage === "offline") return "Connection dropped";
  return item.stage;
}

function card(backgroundColor: string, borderColor: string) {
  return { padding: 16, borderRadius: 16, backgroundColor, borderWidth: 1, borderColor, gap: 4 };
}
