import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, ZoomIn, ZoomOut } from "react-native-reanimated";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CityMap } from "../components/map/CityMap";
import { DriverFace } from "../components/trip/DriverFace";
import { Rise } from "../components/ui/Rise";
import { usePalette } from "../theme/Theme";
import { brand } from "../theme/tokens";
import { useCustomerStore } from "../store/useCustomerStore";
import { kmBetween, lerpPin } from "../lib/geo";
import { naira, uid } from "../lib/format";
import { pricing } from "../lib/fare";
import { clearTripPin, readTripPin, saveTripPin } from "../lib/session";
import { api, hasApi, hasRideService } from "../lib/api";
import { connectRide, publishPassengerLocation, publishRide, stopRide } from "../services/realtime";
import { VoiceBubble, VoiceMic } from "../components/chat/VoiceNote";
import { estimateRoute, etaLabel, type RouteEstimate } from "../lib/routing";

const templates = ["I'm at the pickup", "Where are you?", "I'm coming out", "I'm running late"];

type ChatLine = {
  id: string;
  from: "customer" | "driver";
  text: string;
  kind?: "text" | "voice";
  audioUrl?: string;
  durationMs?: number;
};

export default function Trip() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const trip = useCustomerStore((s) => s.trip);
  const patchTrip = useCustomerStore((s) => s.patchTrip);
  const finishTrip = useCustomerStore((s) => s.finishTrip);
  const addNotice = useCustomerStore((s) => s.addNotice);
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [link, setLink] = useState<"off" | "live" | "reconnecting">("off");
  const [marker, setMarker] = useState(trip?.driver ? { latitude: trip.driver.latitude, longitude: trip.driver.longitude } : null);
  const [eta, setEta] = useState<RouteEstimate | null>(null);
  const thread = useRef<{ scrollToEnd: (options?: { animated?: boolean }) => void } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => thread.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [chat.length, chatOpen]);

  useEffect(() => {
    if (!trip?.sample || !trip.driver) return;
    if (trip.fareTalk === "waiting" || trip.fareTalk === "counter") return;
    const target = trip.stage === "on_trip" ? trip.dropoff : trip.pickup;
    const timer = setInterval(() => {
      const current = useCustomerStore.getState().trip;
      if (!current?.driver) return;
      const from = { latitude: current.driver.latitude, longitude: current.driver.longitude };
      const next = lerpPin(from, target, 0.25);
      const driver = { ...current.driver, ...next };
      const km = kmBetween(next, target);
      if (current.stage === "assigned" && km < 0.4) {
        const code = `${Math.floor(1000 + Math.random() * 9000)}`;
        void saveTripPin(code);
        setPin(code);
        patchTrip({ driver, stage: "arrived" });
        addNotice("Driver has arrived", "Open the trip to see the pickup PIN. It is not in this notice.");
        return;
      }
      if (current.stage === "arrived") return;
      if (current.stage === "on_trip" && km < 0.35) {
        finishTrip("completed");
        void clearTripPin();
        router.replace("/summary");
        return;
      }
      patchTrip({ driver });
    }, 2000);
    return () => clearInterval(timer);
  }, [addNotice, finishTrip, patchTrip, trip?.fareTalk, trip?.id, trip?.sample, trip?.stage]);

  useEffect(() => {
    if (!trip?.driver) return;
    const from = marker ?? trip.driver;
    const to = trip.driver;
    const started = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - started) / 900);
      setMarker(lerpPin(from, to, t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [trip?.driver?.latitude, trip?.driver?.longitude]);

  useEffect(() => {
    if (!trip || trip.sample || !hasApi()) return;
    void api<{
      chat?: Array<{
        id: string;
        from: string;
        text: string;
        kind?: "text" | "voice";
        audioUrl?: string;
        durationMs?: number;
      }>;
    }>(`/rides/${trip.id}`)
      .then((ride) => {
        if (!Array.isArray(ride.chat) || !ride.chat.length) return;
        setChat(
          ride.chat.map((message) => ({
            id: message.id,
            from: message.from === "driver" ? "driver" : "customer",
            text: message.text,
            kind: message.kind || (message.audioUrl ? "voice" : "text"),
            audioUrl: message.audioUrl,
            durationMs: message.durationMs,
          })),
        );
      })
      .catch(() => undefined);
  }, [trip?.id, trip?.sample]);

  useEffect(() => {
    if (!trip || trip.sample || !hasRideService()) return;
    void connectRide(
      {
        onStatus: setLink,
        onDriver: (driver) => patchTrip({ driver, stage: "assigned" }),
        onStage: (stage) => {
          if (stage === "arrived") {
            void readTripPin().then((value) => setPin(value || ""));
            addNotice("Driver has arrived", "Open the trip to see the pickup PIN. It is not in this notice.");
          }
          if (stage === "completed") {
            finishTrip("completed");
            router.replace("/summary");
            return;
          }
          if (stage === "cancelled") {
            finishTrip("cancelled");
            router.replace("/home");
            return;
          }
          patchTrip({ stage });
        },
        onLocation: (latitude, longitude) => {
          const driver = useCustomerStore.getState().trip?.driver;
          if (driver) patchTrip({ driver: { ...driver, latitude, longitude } });
        },
        onMessage: (payload) =>
          setChat((rows) => [
            ...rows,
            {
              id: uid("msg"),
              from: "driver",
              text: payload.text || (payload.audioUrl ? "Voice note" : ""),
              kind: payload.kind || (payload.audioUrl ? "voice" : "text"),
              audioUrl: payload.audioUrl,
              durationMs: payload.durationMs,
            },
          ]),
        onNone: () => patchTrip({ stage: "no_drivers" }),
        onFare: (fare, quoted) => {
          const current = useCustomerStore.getState().trip;
          if (!current || fare <= (quoted || current.quote || current.fare)) {
            patchTrip({ fare, fareTalk: "agreed", counterFare: undefined });
            return;
          }
          patchTrip({ fare, quote: quoted || current.quote, fareTalk: "waiting", counterFare: undefined });
        },
      },
      trip.id,
    );
    return () => stopRide();
  }, [addNotice, finishTrip, patchTrip, trip?.id, trip?.sample]);

  useEffect(() => {
    if (!trip || trip.sample || !hasRideService()) return;
    const timer = setInterval(() => {
      const coords = useCustomerStore.getState().coords;
      if (!coords) return;
      publishPassengerLocation(trip.id, coords.latitude, coords.longitude);
    }, 12_000);
    return () => clearInterval(timer);
  }, [trip?.id, trip?.sample]);

  useEffect(() => {
    if (!trip?.driver || trip.stage === "arrived") return;
    let alive = true;
    const refresh = () => {
      const current = useCustomerStore.getState().trip;
      if (!current?.driver) return;
      const from = { latitude: current.driver.latitude, longitude: current.driver.longitude };
      const to = current.stage === "on_trip" ? current.dropoff : current.pickup;
      void estimateRoute(from, to, current.stage === "on_trip" ? current.stops : []).then((estimate) => {
        if (!alive) return;
        setEta(estimate);
        patchTrip({ km: estimate.km, minutes: estimate.minutes });
      });
    };
    refresh();
    const timer = setInterval(refresh, 75_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [patchTrip, trip?.driver?.id, trip?.id, trip?.stage]);

  if (!trip || !trip.driver) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  const active = trip;
  const driver = trip.driver;
  const target = active.stage === "on_trip" ? active.dropoff : active.pickup;
  const away = eta?.km ?? (marker ? kmBetween(marker, target) : 0);
  const held = trip.fareTalk === "waiting" || trip.fareTalk === "counter";
  const status = held ? "Fare not agreed yet" : trip.stage === "arrived" ? "Driver has arrived" : trip.stage === "on_trip" ? "On the trip" : "Driver is on the way";
  const quote = trip.quote || trip.fare;

  function acceptFare() {
    patchTrip({ fareTalk: "agreed", counterFare: undefined });
    publishRide("ride:fare:reply", { id: active.id, decision: "accepted", fare: active.fare, asked: active.fare });
  }

  function send(body: string) {
    const line = body.trim();
    if (!line) return;
    setChat((rows) => [...rows, { id: uid("msg"), from: "customer", text: line, kind: "text" }]);
    setText("");
    if (hasRideService() && !active.sample) {
      publishRide("trip:message", { id: active.id, from: "customer", text: line, kind: "text" });
    } else if (hasApi() && !active.sample) {
      void api(`/rides/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ kind: "text", text: line }),
      }).catch(() => undefined);
    } else {
      setTimeout(() => setChat((rows) => [...rows, { id: uid("msg"), from: "driver", text: "Okay." }]), 600);
    }
  }

  function sendVoice(note: { audioUrl: string; playUri?: string; durationMs: number }) {
    const line: ChatLine = {
      id: uid("msg"),
      from: "customer",
      text: "Voice note",
      kind: "voice",
      /** Prefer local file URI so you can tap and replay what you just sent. */
      audioUrl: note.playUri || note.audioUrl,
      durationMs: note.durationMs,
    };
    setChat((rows) => [...rows, line]);
    if (hasRideService() && !active.sample) {
      publishRide("trip:message", {
        id: active.id,
        from: "customer",
        text: "Voice note",
        kind: "voice",
        audioUrl: note.audioUrl,
        durationMs: note.durationMs,
      });
    } else if (hasApi() && !active.sample) {
      void api(`/rides/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({
          kind: "voice",
          text: "Voice note",
          audioUrl: note.audioUrl,
          durationMs: note.durationMs,
        }),
      }).catch(() => undefined);
    } else {
      setTimeout(() => setChat((rows) => [...rows, { id: uid("msg"), from: "driver", text: "Got it." }]), 600);
    }
  }

  function callDriver() {
    const phone = driver.phone?.trim();
    if (!phone) {
      setCallNote("This trip has no driver number yet.");
      return;
    }
    setCallNote("");
    void Linking.openURL(`tel:${phone}`);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior="padding" keyboardVerticalOffset={insets.top}>
      <CityMap
        coords={null}
        pickup={trip.pickup}
        dropoff={trip.dropoff}
        stops={trip.stops}
        driver={marker}
        approachLeg={trip.stage === "assigned" || trip.stage === "to_pickup"}
      />
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "space-between" }}>
        <Rise index={0} style={{ marginTop: insets.top + 8, marginHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 22, backgroundColor: palette.paper }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.replace("/home")} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>{status}</Text>
            <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
              {held
                ? "Waiting on the fare"
                : `${away.toFixed(1)} km · ${etaLabel(eta) || `${trip.minutes || Math.max(1, Math.round((away / 25) * 60))} min`}`}
              {" · "}
              {naira(trip.fare)}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Safety" onPress={() => router.push("/safety")} style={iconButton(palette.raised)}>
            <Ionicons name="shield-checkmark" size={18} color={palette.ink} />
          </Pressable>
        </Rise>

        <View pointerEvents="box-none" style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 10, gap: 10 }}>
          {callNote ? <Text style={{ color: palette.ink, backgroundColor: palette.paper, alignSelf: "flex-start", overflow: "hidden", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>{callNote}</Text> : null}
          {link === "reconnecting" ? <Text style={{ color: "#C4482D", backgroundColor: palette.paper, alignSelf: "flex-start", overflow: "hidden", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>Live location paused. The connection dropped.</Text> : null}
          <Rise from="up" index={1} style={{ alignItems: "flex-end", gap: 8 }}>
            {chatOpen ? (
              <Animated.View
                entering={ZoomIn.springify().damping(14).stiffness(180).mass(0.6)}
                exiting={ZoomOut.duration(180)}
                style={{ width: 300, maxHeight: 280, borderRadius: 22, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, padding: 12, gap: 8 }}
              >
                <Text style={{ color: palette.ink, fontWeight: "700" }}>Chat with {driver.name.split(" ")[0]}</Text>
                <ScrollView
                  ref={(node) => {
                    thread.current = node;
                  }}
                  style={{ maxHeight: 120 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 8 }}
                >
                  {chat.length === 0 ? <Text style={{ color: palette.muted }}>Message {driver.name.split(" ")[0]}.</Text> : null}
                  {chat.map((message) => {
                    const mine = message.from === "customer";
                    const voice = message.kind === "voice" && message.audioUrl;
                    return (
                      <View key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "86%", backgroundColor: mine ? palette.accent : palette.raised, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                        {voice ? (
                          <VoiceBubble audioUrl={message.audioUrl!} durationMs={message.durationMs} mine={mine} />
                        ) : (
                          <Text style={{ color: mine ? palette.accentInk : palette.ink }}>{message.text}</Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {templates.map((template) => (
                    <Pressable key={template} onPress={() => send(template)} style={{ height: 30, borderRadius: 15, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "700" }}>{template}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Message"
                    placeholderTextColor={palette.muted}
                    style={{ flex: 1, minHeight: 40, maxHeight: 80, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, color: palette.ink, backgroundColor: palette.raised }}
                  />
                  {text.trim() ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send(text)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent }}>
                      <Ionicons name="send" size={16} color={palette.accentInk} />
                    </Pressable>
                  ) : (
                    <VoiceMic onSend={sendVoice} />
                  )}
                </View>
              </Animated.View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={chatOpen ? "Close chat" : "Open chat"} onPress={() => setChatOpen((value) => !value)} style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent }}>
              <Ionicons name={chatOpen ? "close" : "chatbubble-ellipses"} size={22} color={palette.accentInk} />
              {!chatOpen && chat.length > 0 ? (
                <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#C4482D" }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{chat.length}</Text>
                </View>
              ) : null}
            </Pressable>
          </Rise>

          <Rise from="up" index={2} style={{ borderRadius: 24, backgroundColor: palette.paper, padding: 14, gap: 12 }}>
            {trip.stage === "arrived" ? <Text style={{ color: palette.ink, fontWeight: "700" }}>Your driver is at the pickup.</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <DriverFace name={driver.name} photo={driver.photo} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.ink, fontSize: 18, fontWeight: "800" }} numberOfLines={1}>{driver.name}</Text>
                <Text style={{ color: palette.muted }} numberOfLines={1}>{driver.rating.toFixed(2)} · {driver.vehicle} · {driver.colour}</Text>
                <Text style={{ color: palette.ink, fontWeight: "700" }} numberOfLines={1}>{driver.plate} · {naira(trip.fare)} · {payLabel(trip.payment)}</Text>
                {trip.along ? (
                  <Text style={{ color: palette.muted }} numberOfLines={1}>
                    Along · {trip.seatsTaken ?? 1}/{trip.seatsTotal ?? 3} seats · distance share
                  </Text>
                ) : null}
              </View>
            </View>
            {trip.fareTalk === "waiting" ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: palette.ink, fontWeight: "700" }}>
                  Your driver asked for {naira(trip.fare)}. The quote was {naira(quote)}.
                </Text>
                <Mini label="Accept new fare" onPress={acceptFare} />
              </View>
            ) : null}
            {trip.stage === "arrived" && pin ? (
              <View style={{ padding: 12, borderRadius: 14, backgroundColor: palette.raised }}>
                <Text style={{ color: palette.ink, fontWeight: "700", fontSize: 28, letterSpacing: 6 }}>{pin}</Text>
                <Text style={{ color: palette.muted }}>Show this PIN to your driver before the trip starts. It stays on this screen.</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 2 }}>
              <RideAction label="Call" wash={palette.accent} ring={brand.lemon} onPress={callDriver}>
                <CallMark color={palette.accentInk} />
              </RideAction>
              <RideAction label="Share" wash={palette.accentSoft} ring={palette.line} onPress={() => void Share.share({ message: `Rapyd Ryd trip with ${driver.name}. ${trip.pickup.label} to ${trip.dropoff.label}.` })}>
                <ShareMark color={palette.accent} />
              </RideAction>
              <RideAction label={open ? "Hide" : "Details"} wash={open ? palette.accent : palette.raised} ring={open ? palette.accent : palette.line} onPress={() => setOpen((value) => !value)}>
                <DetailsMark color={open ? palette.accentInk : palette.ink} />
              </RideAction>
            </View>
            {trip.stage !== "on_trip" ? (
              <Pressable
                onPress={() => {
                  publishRide("ride:cancel", { id: trip.id });
                  finishTrip("cancelled");
                  void clearTripPin();
                  router.replace("/home");
                }}
                style={{ minHeight: 36, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#C4482D", fontWeight: "700" }}>Cancel · {naira(pricing.cancellationFee)} after a driver is assigned.</Text>
              </Pressable>
            ) : null}
          </Rise>
        </View>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => undefined} style={{ maxHeight: "86%", backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: palette.line }} />
            <Animated.View entering={FadeIn.duration(280)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <DriverFace name={driver.name} photo={driver.photo} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>DRIVER</Text>
                <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "800" }} numberOfLines={1}>{driver.name}</Text>
                <Text style={{ color: palette.muted }}>{driver.rating.toFixed(2)} · {driver.vehicle}</Text>
              </View>
            </Animated.View>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <View style={panel(palette.paper, palette.line)}>
                <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>ROUTE</Text>
                <Stop title="Pickup" place={trip.pickup.label} dot={brand.lemonDeep} />
                {trip.stops.map((stop) => (
                  <Stop key={stop.id} title="Stop" place={stop.label} dot={brand.gold} />
                ))}
                <Stop title="Dropoff" place={trip.dropoff.label} dot={brand.orange} />
              </View>
              <View style={panel(palette.paper, palette.line)}>
                <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>FARE</Text>
                <Row label="Fare" value={naira(trip.fare)} />
                {quote !== trip.fare ? <Row label="Quote" value={naira(quote)} /> : null}
                <Row label="Class" value={trip.classLabel} />
                <Row label="Pay with" value={payLabel(trip.payment)} />
                <Row label="Vehicle" value={`${driver.colour} ${driver.vehicle}`} />
                <Row label="Plate" value={driver.plate} />
              </View>
              <View style={panel(palette.paper, palette.line)}>
                <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>NOTE</Text>
                <Text style={{ color: palette.ink, lineHeight: 22 }}>Wait at {trip.pickup.label}.</Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function RideAction({ label, wash, ring, onPress, children }: { label: string; wash: string; ring: string; onPress: () => void; children: ReactNode }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 88, alignItems: "center", gap: 8 }}>
      <View style={{ width: 62, height: 62, borderRadius: 22, padding: 3, backgroundColor: ring }}>
        <View style={{ flex: 1, borderRadius: 19, backgroundColor: wash, alignItems: "center", justifyContent: "center" }}>
          {children}
        </View>
      </View>
      <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function CallMark({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M8.1 3.4c.6-.4 1.4-.3 1.9.3l1.3 1.6c.4.5.4 1.2 0 1.7L10 8.6c-.3.4-.2.9.1 1.2l4.1 4.1c.3.3.8.4 1.2.1l1.6-1.3c.5-.4 1.2-.4 1.7 0l1.6 1.3c.6.5.7 1.3.3 1.9l-1.1 1.6c-.6.8-1.6 1.2-2.6 1-2.3-.4-4.6-1.7-6.7-3.8S6.4 9.9 6 7.6c-.2-1 .2-2 1-2.6l1.1-1.6z"
        fill={color}
      />
    </Svg>
  );
}

function ShareMark({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path d="M8.2 11.2 15 7.6M8.2 12.8 15 16.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="6.2" cy="12" r="2.5" fill={color} />
      <Circle cx="17.2" cy="6.4" r="2.5" fill={color} />
      <Circle cx="17.2" cy="17.6" r="2.5" fill={color} />
    </Svg>
  );
}

function DetailsMark({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Rect x="5" y="3.5" width="14" height="17" rx="3.2" fill={color} opacity={0.16} />
      <Rect x="5" y="3.5" width="14" height="17" rx="3.2" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M8.2 8.4h7.6M8.2 12h7.6M8.2 15.6h4.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function Mini({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: palette.raised, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: palette.ink, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Stop({ title, place, dot }: { title: string; place: string; dot: string }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 16, alignItems: "center", paddingTop: 4 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot }} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>{title.toUpperCase()}</Text>
        <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "700" }}>{place}</Text>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
      <Text style={{ color: palette.muted }}>{label}</Text>
      <Text style={{ color: palette.ink, fontWeight: "700", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function panel(backgroundColor: string, borderColor: string) {
  return { borderRadius: 20, padding: 16, gap: 10, backgroundColor, borderWidth: 1, borderColor };
}

function iconButton(backgroundColor: string) {
  return { width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor };
}

function payLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "wallet") return "Wallet";
  if (method === "card") return "Card";
  return method;
}
