import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CityMap } from "../components/map/CityMap";
import { DriverFace } from "../components/trip/DriverFace";
import { Button } from "../components/ui/Button";
import { usePalette } from "../theme/Theme";
import { useCustomerStore, type DriverCard } from "../store/useCustomerStore";
import { naira } from "../lib/format";
import { kmBetween } from "../lib/geo";
import { bearing } from "../lib/dummy";
import { hasRideService } from "../lib/api";
import { EXTENDED_SEARCH_RADIUS_KM, FARE_TOPUP_RATIO, SEARCH_RADIUS_KM, STEP } from "../lib/fare";
import { sampleOffers } from "../lib/sample";
import { connectRide, publishRide, stopRide } from "../services/realtime";
import { estimateRoute, etaLabel, type RouteEstimate } from "../lib/routing";
import { useNearbyDrivers } from "../hooks/useNearbyDrivers";

const NEARBY_WAIT_MS = 18_000;
/** After drivers are visible but none accepted, offer a fare top-up. */
const TOPUP_HINT_MS = 14_000;

export default function Matching() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const trip = useCustomerStore((s) => s.trip);
  const patchTrip = useCustomerStore((s) => s.patchTrip);
  const finishTrip = useCustomerStore((s) => s.finishTrip);
  const [offers, setOffers] = useState<DriverCard[]>([]);
  const [link, setLink] = useState(hasRideService() ? "connecting" : "sample");
  const [etas, setEtas] = useState<Record<string, RouteEstimate>>({});
  const [extended, setExtended] = useState(false);
  const [nearbyTimedOut, setNearbyTimedOut] = useState(false);
  const [nearbyPromptOpen, setNearbyPromptOpen] = useState(false);
  const [extendConfirmOpen, setExtendConfirmOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [topUpOffered, setTopUpOffered] = useState(false);
  const [topUpDismissed, setTopUpDismissed] = useState(false);
  const [toppedUp, setToppedUp] = useState(false);
  const spin = useSharedValue(0);
  const radiusKm = extended ? EXTENDED_SEARCH_RADIUS_KM : SEARCH_RADIUS_KM;
  const liveCars = useNearbyDrivers(trip?.pickup, radiusKm);
  const originalQuote = trip?.quote || trip?.fare || 0;
  const topUpAmount = Math.max(STEP, Math.round((originalQuote * FARE_TOPUP_RATIO) / STEP) * STEP);
  const toppedFare = originalQuote + topUpAmount;

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [spin]);
  const pulse = useAnimatedStyle(() => ({ opacity: 0.4 + spin.value * 0.6 }));

  useEffect(() => {
    if (!trip || trip.stage !== "searching") return;
    setOffers([]);
    setNearbyTimedOut(false);
    let cancelled = false;
    let nearbyTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    /** Ignore ride:none until we've joined the room and asked for a fresh dispatch. */
    let acceptNone = false;

    if (hasRideService()) {
      void (async () => {
        await connectRide(
          {
            onStatus: (status) => setLink(status),
            onDriver: (driver) => {
              // ride:driver after accept — go to trip (route to pickup shows there).
              const current = useCustomerStore.getState().trip;
              patchTrip({
                driver,
                stage: current?.stage === "to_pickup" ? "to_pickup" : "assigned",
                fare: driver.fare || current?.fare,
              });
              router.replace("/trip");
            },
            onBid: (driver) => {
              // Only show a bid after the driver adjusts fare (or explicitly bids).
              const away = kmBetween(driver, trip.pickup);
              if (away > radiusKm + 0.5) return;
              setOffers((rows) => {
                const card = { ...driver, bid: true };
                const rest = rows.filter((item) => item.id !== driver.id);
                return [card, ...rest].slice(0, 5);
              });
            },
            onStage: (stage) => {
              patchTrip({ stage });
              if (stage === "assigned" || stage === "to_pickup") {
                router.replace("/trip");
              }
            },
            onLocation: (latitude, longitude) => {
              const current = useCustomerStore.getState().trip?.driver;
              if (!current) return;
              patchTrip({ driver: { ...current, latitude, longitude } });
            },
            onMessage: () => undefined,
            onNone: () => {
              if (!acceptNone) return;
              if (!extended) setNearbyTimedOut(true);
              else patchTrip({ stage: "no_drivers" });
            },
          },
          trip.id,
        );
        if (cancelled) return;

        acceptNone = true;
        publishRide("ride:request", {
          id: trip.id,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          fare: trip.fare,
          classId: trip.classId,
          along: trip.along === true || trip.classId === "along",
          poolId: trip.poolId || undefined,
          radiusKm,
          extendedSearch: extended,
          /** Drivers outside the standard radius set their own pickup price. */
          driverPriced: extended,
        });

        nearbyTimer = setTimeout(() => {
          if (!extended) setNearbyTimedOut(true);
        }, NEARBY_WAIT_MS);
        hardTimer = setTimeout(() => {
          if (useCustomerStore.getState().trip?.stage === "searching" && extended) {
            patchTrip({ stage: "timeout" });
          }
        }, 45_000);
      })();

      return () => {
        cancelled = true;
        if (nearbyTimer) clearTimeout(nearbyTimer);
        if (hardTimer) clearTimeout(hardTimer);
        stopRide();
      };
    }

    const pool = sampleOffers(trip.quote || trip.fare, trip.pickup.latitude, trip.pickup.longitude, {
      maxKm: radiusKm,
      nearOnly: !extended,
    }).sort((a, b) => kmBetween(a, trip.pickup) - kmBetween(b, trip.pickup));

    const timers = pool.map((driver, index) =>
      setTimeout(() => {
        setOffers((rows) => (rows.some((item) => item.id === driver.id) ? rows : [...rows, driver]));
      }, 1200 + index * 1400),
    );
    nearbyTimer = setTimeout(() => {
      if (!extended) setNearbyTimedOut(true);
    }, NEARBY_WAIT_MS);
    return () => {
      timers.forEach(clearTimeout);
      if (nearbyTimer) clearTimeout(nearbyTimer);
    };
  }, [extended, patchTrip, radiusKm, searchKey, trip]);

  useEffect(() => {
    if (!trip || offers.length === 0) return;
    let alive = true;
    const refresh = () => {
      void Promise.all(
        offers.map(async (driver) => {
          const estimate = await estimateRoute({ latitude: driver.latitude, longitude: driver.longitude }, trip.pickup);
          return [driver.id, estimate] as const;
        }),
      ).then((rows) => {
        if (alive) setEtas(Object.fromEntries(rows));
      });
    };
    refresh();
    const timer = setInterval(refresh, 75_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [offers, trip]);

  /** Drivers are visible but not taking the ride — suggest topping up 20% of the original fare. */
  useEffect(() => {
    if (!trip || trip.stage !== "searching" || toppedUp || topUpDismissed || extended) return;
    if (offers.length === 0) return;
    const timer = setTimeout(() => setTopUpOffered(true), TOPUP_HINT_MS);
    return () => clearTimeout(timer);
  }, [extended, offers.length, topUpDismissed, toppedUp, trip]);

  const nearbyOffers = useMemo(() => {
    if (!trip) return [];
    return offers.filter((driver) => kmBetween(driver, trip.pickup) <= radiusKm);
  }, [offers, radiusKm, trip]);

  /** Nearby cars from pickup-centered /drivers/nearby — don't claim "none" if the map still has them. */
  const noNearby =
    Boolean(trip) &&
    !extended &&
    nearbyTimedOut &&
    nearbyOffers.length === 0 &&
    liveCars.length === 0;

  useEffect(() => {
    if (noNearby) setNearbyPromptOpen(true);
  }, [noNearby]);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }}>
        <Button label="Home" onPress={() => router.replace("/home")} />
      </View>
    );
  }

  const quiet =
    nearbyOffers.length === 0 &&
    (trip.stage === "timeout" || trip.stage === "no_drivers" || trip.stage === "offline" || link === "reconnecting");
  const title = quiet
    ? "No driver yet"
    : nearbyOffers.length > 0
      ? nearbyOffers.some((item) => item.fareTalk === "waiting")
        ? "Driver bid — review fare"
        : "Driver ready — choose"
      : extended
        ? "Extending the search…"
        : "Finding a driver";

  const cars = hasRideService()
    ? liveCars
    : nearbyOffers.map((driver) => ({
        id: driver.id,
        latitude: driver.latitude,
        longitude: driver.longitude,
        heading: (bearing(driver, trip.pickup) + 360) % 360,
      }));

  function confirmExtendSearch() {
    setExtendConfirmOpen(false);
    setNearbyPromptOpen(false);
    setExtended(true);
    setNearbyTimedOut(false);
    setTopUpOffered(false);
    setOffers([]);
    setSearchKey((value) => value + 1);
    if (trip.stage !== "searching") patchTrip({ stage: "searching" });
  }

  function applyTopUp() {
    if (!trip || toppedUp) return;
    const nextFare = Math.max(trip.fare, toppedFare);
    patchTrip({ fare: nextFare });
    setToppedUp(true);
    setTopUpOffered(false);
    publishRide("ride:request", {
      id: trip.id,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      fare: nextFare,
      quote: trip.quote,
      classId: trip.classId,
      along: trip.along === true || trip.classId === "along",
      poolId: trip.poolId || undefined,
      radiusKm,
      extendedSearch: extended,
      fareTopUp: topUpAmount,
      driverPriced: extended,
    });
    /** Demo: refresh nearby offers against the higher fare so the board feels more responsive. */
    if (!hasRideService()) {
      setOffers([]);
      setSearchKey((value) => value + 1);
    }
  }

  function pickDriver(driver: DriverCard) {
    const away = etas[driver.id]?.km ?? kmBetween(driver, trip.pickup);
    const eta = etas[driver.id];
    /** Extended / far drivers bring their own price — rider confirms that offer. */
    const driverPriced = extended || away > SEARCH_RADIUS_KM;
    patchTrip({
      stage: "assigned",
      driver,
      fare: driver.fare,
      sample: !hasRideService(),
      fareTalk: driverPriced ? "waiting" : "agreed",
      km: trip.km || eta?.km || away,
      minutes: eta?.minutes || trip.minutes,
    });
    router.replace("/trip");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <CityMap pickup={trip.pickup} dropoff={trip.dropoff} stops={trip.stops} cars={cars} searching />
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 16,
          gap: 10,
          backgroundColor: palette.paper,
          borderRadius: 24,
          padding: 16,
        }}
      >
        <Animated.Text style={[{ color: palette.ink, fontSize: 22, fontWeight: "800" }, pulse]}>
          {title}
        </Animated.Text>
        <Text style={{ color: palette.muted }}>
          {trip.pickup.label} → {trip.dropoff.label}
        </Text>
        <Text style={{ color: palette.ink }}>
          {trip.classLabel} · fare {naira(trip.fare)}
          {toppedUp ? " · topped up" : ""}
          {extended ? " · extended search" : ""}
        </Text>
        {link === "reconnecting" ? <Text style={{ color: "#C4482D" }}>The trip connection dropped.</Text> : null}

        {topUpOffered && !toppedUp ? (
          <View
            style={{
              gap: 10,
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: palette.accent,
              backgroundColor: palette.accentSoft,
            }}
          >
            <Text style={{ color: palette.ink, fontWeight: "800" }}>Get a quicker response?</Text>
            <Text style={{ color: palette.muted, lineHeight: 20 }}>
              Nearby drivers may be holding out on this price. Top up {naira(topUpAmount)} (20% of your original fare) to{" "}
              {naira(toppedFare)} so they are more likely to accept.
            </Text>
            <Button label={`Top up ${naira(topUpAmount)}`} onPress={applyTopUp} />
            <Pressable onPress={() => { setTopUpDismissed(true); setTopUpOffered(false); }} style={{ minHeight: 40, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: palette.muted, fontWeight: "700" }}>Not now</Text>
            </Pressable>
          </View>
        ) : null}

        {nearbyOffers.map((driver, index) => {
          const away = etas[driver.id]?.km ?? kmBetween(driver, trip.pickup);
          const eta = etas[driver.id];
          const far = away > SEARCH_RADIUS_KM;
          return (
            <Pressable
              key={driver.id}
              onPress={() => pickDriver(driver)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.raised,
              }}
            >
              <DriverFace name={driver.name} photo={driver.photo} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.ink, fontWeight: "800" }}>{driver.name}</Text>
                <Text style={{ color: palette.muted }}>
                  {away.toFixed(1)} km · {etaLabel(eta) || `${Math.max(1, Math.round((away / 25) * 60))} min`} · {driver.vehicle} ·{" "}
                  {driver.rating.toFixed(2)}
                </Text>
                {eta?.isTrafficHeavy ? (
                  <Text style={{ color: "#C4482D", fontWeight: "700", marginTop: 2 }}>Heavy traffic</Text>
                ) : null}
                {driver.fareTalk === "waiting" || driver.bid ? (
                  <Text style={{ color: palette.accent, fontWeight: "700", marginTop: 2 }}>
                    {(driver.classLabel || driver.classId || "Ryde").toString()} · driver bid
                  </Text>
                ) : far ? (
                  <Text style={{ color: palette.accent, fontWeight: "700", marginTop: 2 }}>Driver-set price · further out</Text>
                ) : (
                  <Text style={{ color: palette.accent, fontWeight: "700", marginTop: 2 }}>Ready to accept</Text>
                )}
              </View>
              <Text style={{ color: palette.ink, fontWeight: "800", fontSize: 18 }}>{naira(driver.fare)}</Text>
            </Pressable>
          );
        })}

        {quiet ? (
          <Text style={{ color: palette.muted, lineHeight: 20 }}>
            Still no driver in range. You can cancel and try again in a few minutes.
          </Text>
        ) : null}

        <Button
          label="Cancel booking"
          kind="danger"
          onPress={() => {
            publishRide("ride:cancel", { id: trip.id });
            finishTrip("cancelled");
            router.replace("/home");
          }}
        />
      </View>

      <Modal
        visible={nearbyPromptOpen && !extendConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNearbyPromptOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", padding: 16, paddingBottom: insets.bottom + 16 }}>
          <View style={{ backgroundColor: palette.paper, borderRadius: 24, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "800" }}>No ride available nearby</Text>
            <Text style={{ color: palette.muted, lineHeight: 22 }}>
              We could not find a driver close enough right now. You can keep waiting, or extend the search to drivers further away.
            </Text>
            <Button
              label="Extend search"
              onPress={() => {
                setNearbyPromptOpen(false);
                setExtendConfirmOpen(true);
              }}
            />
            <Button label="Keep waiting" kind="quiet" onPress={() => setNearbyPromptOpen(false)} />
            <Button
              label="Cancel booking"
              kind="danger"
              onPress={() => {
                setNearbyPromptOpen(false);
                publishRide("ride:cancel", { id: trip.id });
                finishTrip("cancelled");
                router.replace("/home");
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={extendConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setExtendConfirmOpen(false);
          setNearbyPromptOpen(true);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", padding: 16, paddingBottom: insets.bottom + 16 }}>
          <View style={{ backgroundColor: palette.paper, borderRadius: 24, padding: 20, gap: 12 }}>
            <Text style={{ color: palette.ink, fontSize: 22, fontWeight: "800" }}>Extra pickup charge</Text>
            <Text style={{ color: palette.muted, lineHeight: 22 }}>
              Extending the search can find a driver further away. If a ride is found, a small extra charge may apply based on how far the driver travels to reach your pickup. The driver sets that pickup price before you confirm.
            </Text>
            <Button label="Continue extended search" onPress={confirmExtendSearch} />
            <Button
              label="Go back"
              kind="quiet"
              onPress={() => {
                setExtendConfirmOpen(false);
                setNearbyPromptOpen(true);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
