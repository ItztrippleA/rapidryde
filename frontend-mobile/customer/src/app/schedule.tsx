import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { useCustomerStore } from "../store/useCustomerStore";
import { SCHEDULE_AHEAD_DAYS } from "../lib/fare";
import { naira, whenLabel } from "../lib/format";
import { remindPickup } from "../services/device";

const LEAD_MS = 15 * 60 * 1000;
const SLOT_MS = 30 * 60 * 1000;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfTomorrow() {
  const end = new Date();
  end.setDate(end.getDate() + SCHEDULE_AHEAD_DAYS);
  end.setHours(23, 59, 0, 0);
  return end.getTime();
}

function dayLabel(date: Date) {
  const today = startOfDay(new Date());
  if (dayKey(date) === dayKey(today)) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dayKey(date) === dayKey(tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function slotsFor(day: Date) {
  const now = Date.now();
  const latest = endOfTomorrow();
  const slots: number[] = [];
  const cursor = startOfDay(day);
  for (let i = 0; i < 48; i += 1) {
    const stamp = cursor.getTime() + i * SLOT_MS;
    if (stamp > now + LEAD_MS && stamp <= latest) slots.push(stamp);
  }
  return slots;
}

function timeLabel(stamp: number) {
  return new Date(stamp).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

export default function Schedule() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ id?: string }>();
  const scheduled = useCustomerStore((s) => s.scheduled);
  const existing = scheduled.find((item) => item.id === params.id);
  const booking = useCustomerStore((s) => s.booking);
  const setSchedule = useCustomerStore((s) => s.setSchedule);
  const updateScheduled = useCustomerStore((s) => s.updateScheduled);
  const cancelScheduled = useCustomerStore((s) => s.cancelScheduled);
  const seed = existing?.scheduledAt ? new Date(existing.scheduledAt) : null;
  const booked = scheduled.filter(
    (item) => item.id !== existing?.id && item.scheduledAt && item.stage !== "cancelled" && item.stage !== "completed",
  );

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let offset = 0; offset <= SCHEDULE_AHEAD_DAYS; offset += 1) {
      const day = startOfDay(new Date());
      day.setDate(day.getDate() + offset);
      if (slotsFor(day).length) list.push(day);
    }
    return list;
  }, []);

  const [day, setDay] = useState(seed ? dayKey(seed) : dayKey(days[0] ?? new Date()));
  const chosenDay = days.find((item) => dayKey(item) === day) ?? days[0];
  const slots = chosenDay ? slotsFor(chosenDay) : [];
  const seedSlot =
    seed && slots.includes(seed.getTime())
      ? seed.getTime()
      : seed
        ? slots.find((slot) => Math.abs(slot - seed.getTime()) < SLOT_MS) ?? slots[0]
        : slots[0];
  const [stamp, setStamp] = useState<number | null>(seedSlot ?? null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const activeStamp = stamp && slots.includes(stamp) ? stamp : slots[0] ?? null;
  const valid = Boolean(activeStamp && activeStamp > Date.now() + LEAD_MS && activeStamp <= endOfTomorrow());

  function continueNew() {
    if (!valid || !activeStamp) return;
    setSchedule(activeStamp);
    router.push("/book");
  }

  function saveExisting() {
    if (!existing || !valid || !activeStamp) return;
    updateScheduled(existing.id, { scheduledAt: activeStamp });
    void remindPickup(activeStamp, `${existing.pickup.label} to ${existing.dropoff.label}`);
    router.replace("/trips");
  }

  return (
    <Screen
      footer={
        existing ? (
          <>
            <Button label="Save pickup time" onPress={saveExisting} disabled={!valid} />
            {confirmCancel ? (
              <Button
                label="Cancel this scheduled ride"
                kind="danger"
                onPress={() => {
                  cancelScheduled(existing.id);
                  router.replace("/trips");
                }}
              />
            ) : (
              <Button label="Cancel scheduled ride" kind="quiet" onPress={() => setConfirmCancel(true)} />
            )}
          </>
        ) : (
          <Button label="Continue" onPress={continueNew} disabled={!valid} />
        )
      }
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: palette.accent, fontWeight: "700" }}>Back</Text>
      </Pressable>
      <Text style={{ color: palette.ink, fontSize: 32, fontWeight: "700" }}>{existing ? "Scheduled ride" : "Schedule a ride"}</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>
        Pick today or tomorrow, then a time. The ride waits for that pickup — it is not sent to drivers yet. A reminder is set 30 minutes before, on this phone.
      </Text>
      {existing ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>
            {existing.pickup.label} → {existing.dropoff.label}
          </Text>
          <Text style={{ color: palette.muted }}>
            {existing.classLabel} · {naira(existing.fare)} · {existing.payment}
          </Text>
          <Text style={{ color: palette.ink }}>
            Status:{" "}
            {existing.stage === "to_pickup" || existing.stage === "assigned"
              ? "Driver is heading to pickup."
              : existing.stage === "arrived"
                ? "Driver has arrived."
                : existing.stage === "on_trip"
                  ? "Trip in progress."
                  : existing.stage === "cancelled"
                    ? "Cancelled."
                    : "scheduled, waiting for the driver to embark."}
          </Text>
        </View>
      ) : (
        <Text style={{ color: palette.muted }}>
          {booking.pickup?.label || "Pickup comes next"} → {booking.dropoff?.label || "Destination comes next"}
        </Text>
      )}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="calendar" size={18} color={palette.accent} />
          <Text style={{ color: palette.ink, fontWeight: "800" }}>Date</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {days.map((item) => {
            const key = dayKey(item);
            const selected = key === day;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(item)}
                onPress={() => {
                  setDay(key);
                  const next = slotsFor(item);
                  setStamp(next[0] ?? null);
                }}
                style={{
                  flex: 1,
                  minHeight: 72,
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? palette.accent : palette.line,
                  backgroundColor: selected ? palette.accentSoft : palette.paper,
                  gap: 2,
                }}
              >
                <Text style={{ color: selected ? palette.accent : palette.muted, fontSize: 12, fontWeight: "800" }}>
                  {dayLabel(item).toUpperCase()}
                </Text>
                <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 16 }}>
                  {item.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="time" size={18} color={palette.accent} />
          <Text style={{ color: palette.ink, fontWeight: "800" }}>Time</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {slots.map((value) => {
            const selected = value === activeStamp;
            return (
              <Pressable
                key={value}
                onPress={() => setStamp(value)}
                style={{
                  minWidth: 88,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  alignItems: "center",
                  backgroundColor: selected ? palette.accent : palette.raised,
                }}
              >
                <Text style={{ color: selected ? palette.accentInk : palette.ink, fontWeight: "700" }}>{timeLabel(value)}</Text>
              </Pressable>
            );
          })}
        </View>
        {!slots.length ? <Text style={{ color: "#C4482D" }}>No times left on this day. Try tomorrow.</Text> : null}
      </View>

      {valid && activeStamp ? (
        <Text style={{ color: palette.ink, fontWeight: "700" }}>Pickup {whenLabel(activeStamp)}</Text>
      ) : (
        <Text style={{ color: "#C4482D" }}>Pick a time at least 15 minutes from now, today or tomorrow only.</Text>
      )}

      {!existing && booked.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.ink, fontWeight: "700" }}>Already booked</Text>
          {booked.map((ride) => (
            <Pressable
              key={ride.id}
              onPress={() => router.push({ pathname: "/schedule", params: { id: ride.id } })}
              style={{ padding: 14, borderRadius: 16, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, gap: 4 }}
            >
              <Text style={{ color: palette.ink, fontWeight: "700" }}>
                {ride.pickup.label} → {ride.dropoff.label}
              </Text>
              <Text style={{ color: palette.muted }}>{ride.scheduledAt ? whenLabel(ride.scheduledAt) : "Time not set"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
