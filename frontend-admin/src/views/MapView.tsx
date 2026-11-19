"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverPeek, type PeekDriver, type PeekRide } from "@/components/map/DriverPeek";
import { FleetMap } from "@/components/map/FleetMap";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { fromGrid, inside, ring, toGrid } from "@/lib/geo";
import { cityLabel, naira, titleCase } from "@/lib/format";
import type { CityId } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

type LiveDriver = {
  driverId: string;
  name: string;
  phone: string;
  status: "offline" | "available" | "on_trip" | "busy";
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  online: boolean;
  activeRideId: string | null;
  poolId: string | null;
  lastSeenAt: number;
  accountStatus?: string;
  maxDispatchRadiusKm?: number;
  effectiveRadiusKm?: number;
};

type LookingDriver = {
  driverId: string;
  name: string;
  phone: string;
  km: number;
  latitude?: number | null;
  longitude?: number | null;
  maxDispatchRadiusKm: number;
  effectiveRadiusKm: number;
  canSee: boolean;
  shortfallKm: number;
};

type LookingRide = {
  rideId: string;
  city: string;
  customer: { id?: string; name?: string; phone?: string };
  pickup: { label: string; latitude: number; longitude: number };
  position?: {
    latitude: number;
    longitude: number;
    at?: number;
    source?: "live" | "pickup";
  };
  dropoff: { label: string };
  classLabel?: string;
  fare: number;
  createdAt: number;
  waitingMs: number;
  closest: LookingDriver | null;
  nearby: LookingDriver[];
};

type ApiRide = {
  id: string;
  status: string;
  classId?: string;
  classLabel?: string;
  payment?: string;
  fare?: number;
  quoted?: number;
  earnings?: number;
  plannedKm?: number;
  plannedMinutes?: number;
  note?: string;
  startedAt?: number | null;
  assignedAt?: number | null;
  pickup?: { label?: string } | string;
  dropoff?: { label?: string } | string;
  customer?: { name?: string; phone?: string };
};

/** Stable demo heading from an id when GPS heading is missing. */
function seedHeading(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

function formatBearing(heading: number | null | undefined) {
  if (heading == null || !Number.isFinite(heading)) return null;
  const deg = ((heading % 360) + 360) % 360;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${labels[index]}`;
}

function statusTone(status: LiveDriver["status"]) {
  if (status === "on_trip") return "ok" as const;
  if (status === "busy") return "warn" as const;
  if (status === "available") return "ok" as const;
  return "off" as const;
}

function stopLabel(value: ApiRide["pickup"]) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.label || "";
}

function mapApiRide(ride: ApiRide): PeekRide {
  return {
    id: ride.id,
    status: ride.status,
    classId: ride.classId,
    classLabel: ride.classLabel,
    payment: ride.payment,
    fare: ride.fare,
    quoted: ride.quoted,
    earnings: ride.earnings,
    plannedKm: ride.plannedKm,
    plannedMinutes: ride.plannedMinutes,
    pickup: stopLabel(ride.pickup),
    dropoff: stopLabel(ride.dropoff),
    customerName: ride.customer?.name,
    customerPhone: ride.customer?.phone,
    note: ride.note,
    startedAt: ride.startedAt,
    assignedAt: ride.assignedAt,
  };
}

export function MapView() {
  const seedDrivers = useAdminStore((state) => state.drivers);
  const seedRides = useAdminStore((state) => state.rides);
  const seedCustomers = useAdminStore((state) => state.customers);
  const rideZones = useAdminStore((state) => state.rideZones);
  const deliveryZones = useAdminStore((state) => state.deliveryZones);
  const [city, setCity] = useState<CityId>("abuja");
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [mapLayer, setMapLayer] = useState<"both" | "customers" | "drivers">("both");
  const [showDeliveryZones, setShowDeliveryZones] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSearcher, setSelectedSearcher] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const [live, setLive] = useState<LiveDriver[]>([]);
  const [looking, setLooking] = useState<LookingRide[]>([]);
  const [source, setSource] = useState<"api" | "seed">("seed");
  const [error, setError] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [extending, setExtending] = useState<string | null>(null);
  const [assignRow, setAssignRow] = useState<LookingRide | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [tick, setTick] = useState(0);
  const [ride, setRide] = useState<PeekRide | null>(null);
  const [rideLoading, setRideLoading] = useState(false);

  const loadLive = useCallback(async () => {
    if (!hasApi()) {
      setSource("seed");
      setLooking([]);
      return;
    }
    try {
      setError("");
      const { token } = await adminLogin();
      const [rows, demand] = await Promise.all([
        api<LiveDriver[]>(
          `/admin/drivers/live?city=${city}&onlineOnly=${onlineOnly ? "true" : "false"}`,
          { token },
        ),
        api<LookingRide[]>(`/admin/rides/looking?city=${city}`, { token }).catch(() => [] as LookingRide[]),
      ]);
      setLive(rows);
      setLooking(demand);
      setSource(rows.length > 0 || demand.length > 0 ? "api" : "seed");
    } catch (err) {
      setSource("seed");
      setLooking([]);
      setError(err instanceof Error ? err.message : "Live fleet unavailable");
    }
  }, [city, onlineOnly]);

  useEffect(() => {
    void loadLive();
  }, [loadLive, tick]);

  async function extendClosest(row: LookingRide) {
    if (!row.closest || !hasApi()) return;
    setExtending(row.rideId);
    setActionNote("");
    try {
      const { token } = await adminLogin();
      const updated = await api<{ effectiveRadiusKm: number; maxDispatchRadiusKm: number }>(
        `/admin/drivers/${row.closest.driverId}/extend-range`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ rideId: row.rideId }),
        },
      );
      setActionNote(
        `${row.closest.name} can now see pickups within ${updated.effectiveRadiusKm} km (was ${row.closest.effectiveRadiusKm} km).`,
      );
      setTick((n) => n + 1);
    } catch (err) {
      setActionNote(err instanceof Error ? err.message : "Could not extend range");
    } finally {
      setExtending(null);
    }
  }

  function openAssign(row: LookingRide, preferredDriverId?: string) {
    const fallback =
      preferredDriverId ||
      row.closest?.driverId ||
      row.nearby.find((d) => d.canSee)?.driverId ||
      live.find((d) => d.online && d.status === "available")?.driverId ||
      "";
    setAssignDriverId(fallback);
    setAssignRow(row);
  }

  async function confirmAssign() {
    if (!assignRow || !assignDriverId || !hasApi()) return;
    setAssigning(true);
    setActionNote("");
    try {
      const { token } = await adminLogin();
      const driver =
        live.find((d) => d.driverId === assignDriverId) ||
        (assignRow.closest?.driverId === assignDriverId ? assignRow.closest : null) ||
        assignRow.nearby.find((d) => d.driverId === assignDriverId);
      await api(`/rides/${assignRow.rideId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({
          driverId: assignDriverId,
          driverName: driver && "name" in driver ? driver.name : undefined,
          driverPhone: driver && "phone" in driver ? driver.phone : undefined,
          latitude: driver && "latitude" in driver ? driver.latitude ?? undefined : undefined,
          longitude: driver && "longitude" in driver ? driver.longitude ?? undefined : undefined,
          fare: assignRow.fare,
        }),
      });
      const name = driver && "name" in driver ? driver.name : "Driver";
      setActionNote(`Assigned ${assignRow.customer?.name || "customer"} to ${name}.`);
      setAssignRow(null);
      setTick((n) => n + 1);
    } catch (err) {
      setActionNote(err instanceof Error ? err.message : "Could not assign driver");
    } finally {
      setAssigning(false);
    }
  }

  const assignChoices = useMemo(() => {
    if (!assignRow) return [] as Array<{ id: string; label: string }>;
    const seen = new Set<string>();
    const rows: Array<{ id: string; label: string }> = [];
    const push = (id: string, label: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push({ id, label });
    };
    for (const nearby of assignRow.nearby) {
      push(nearby.driverId, `${nearby.name} · ${nearby.km.toFixed(1)} km${nearby.canSee ? "" : " · out of range"}`);
    }
    if (assignRow.closest) {
      push(
        assignRow.closest.driverId,
        `${assignRow.closest.name} · ${assignRow.closest.km.toFixed(1)} km (closest)`,
      );
    }
    for (const driver of live.filter((d) => d.online && (!d.city || d.city === city))) {
      push(
        driver.driverId,
        `${driver.name} · ${titleCase(driver.status)}${driver.status === "available" ? "" : " · busy"}`,
      );
    }
    return rows;
  }, [assignRow, live, city]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const seedActiveRide = useCallback(
    (driverId: string): PeekRide | null => {
      const match = seedRides.find(
        (item) =>
          item.driverId === driverId &&
          (item.status === "on_trip" || item.status === "assigned" || item.status === "searching"),
      );
      if (!match) return null;
      const customer = seedCustomers.find((item) => item.id === match.customerId);
      return {
        id: match.id,
        status: match.status,
        classId: match.classId,
        classLabel: match.along ? "Along" : undefined,
        pickup: match.pickup,
        dropoff: match.dropoff,
        fare: match.fare,
        plannedKm: match.distanceKm,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        when: match.when,
        along: match.along,
        poolId: match.poolId,
        seatsTotal: match.seatsTotal,
        riders: match.riders,
      };
    },
    [seedCustomers, seedRides],
  );

  const markers = useMemo(() => {
    if (source === "api") {
      return live
        .filter((driver) => !onlineOnly || driver.online)
        .filter((driver) => !driver.city || driver.city === city)
        .map((driver) => {
          const point =
            driver.latitude != null && driver.longitude != null
              ? toGrid(city, driver.latitude, driver.longitude)
              : { x: 50, y: 50 };
          return {
            id: driver.driverId,
            name: driver.name,
            x: point.x,
            y: point.y,
            lat: driver.latitude,
            lng: driver.longitude,
            online: driver.online,
            status: driver.status,
            heading: driver.heading ?? seedHeading(driver.driverId),
          };
        });
    }
    return seedDrivers
      .filter((driver) => driver.city === city)
      .filter((driver) => (onlineOnly ? driver.online : true))
      .map((driver) => {
        const active = seedActiveRide(driver.id);
        const status = !driver.online
          ? ("offline" as const)
          : active?.status === "on_trip"
            ? ("on_trip" as const)
            : active
              ? ("busy" as const)
              : ("available" as const);
        const geo = fromGrid(city, driver.x, driver.y);
        const poolRide = seedRides.find(
          (ride) => ride.driverId === driver.id && ride.along && (ride.status === "on_trip" || ride.status === "assigned"),
        );
        return {
          id: driver.id,
          name: driver.name,
          x: driver.x,
          y: driver.y,
          lat: geo.lat,
          lng: geo.lng,
          online: driver.online,
          status,
          heading: seedHeading(driver.id),
          along: Boolean(poolRide?.along),
          poolTaken: poolRide?.riders?.length ?? 0,
          poolTotal: poolRide?.seatsTotal ?? 3,
        };
      });
  }, [source, live, seedDrivers, seedRides, city, onlineOnly, seedActiveRide]);

  const searcherOverlays = useMemo(() => {
    const rows =
      source === "api"
        ? looking
        : seedRides
            .filter((ride) => ride.status === "searching")
            .map((ride) => {
              const customer = seedCustomers.find((item) => item.id === ride.customerId);
              const driver = seedDrivers.find((item) => item.city === city && item.online);
              return {
                rideId: ride.id,
                city,
                customer: { name: customer?.name, phone: customer?.phone },
                pickup: { label: ride.pickup, latitude: 0, longitude: 0 },
                position: undefined as LookingRide["position"],
                dropoff: { label: ride.dropoff },
                fare: ride.fare,
                createdAt: Date.now(),
                waitingMs: 0,
                closest: driver
                  ? {
                      driverId: driver.id,
                      name: driver.name,
                      phone: driver.phone,
                      km: 2.4,
                      latitude: fromGrid(city, driver.x, driver.y).lat,
                      longitude: fromGrid(city, driver.x, driver.y).lng,
                      maxDispatchRadiusKm: 10,
                      effectiveRadiusKm: 10,
                      canSee: true,
                      shortfallKm: 0,
                    }
                  : null,
                nearby: [] as LookingDriver[],
              } satisfies LookingRide;
            });

    const searchers = rows
      .map((row) => {
        const lat = row.position?.latitude ?? row.pickup.latitude;
        const lng = row.position?.longitude ?? row.pickup.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          // Seed rows without coords — place near map center with a stable offset.
          const offset = (row.rideId.charCodeAt(row.rideId.length - 1) % 7) - 3;
          const x = 48 + offset * 3;
          const y = 42 + offset * 2;
          const geo = fromGrid(city, x, y);
          return {
            id: row.rideId,
            name: row.customer?.name || "Customer",
            x,
            y,
            lat: geo.lat,
            lng: geo.lng,
            live: false,
            label: "Searching",
          };
        }
        const point = toGrid(city, lat, lng);
        return {
          id: row.rideId,
          name: row.customer?.name || "Customer",
          x: point.x,
          y: point.y,
          lat,
          lng,
          live: row.position?.source === "live",
          label: row.position?.source === "live" ? "Live" : "Pickup",
        };
      });

    const driverPoints = new Map(markers.map((m) => [m.id, m]));
    const links = rows
      .map((row) => {
        const from = searchers.find((s) => s.id === row.rideId);
        const closest = row.closest;
        if (!from || !closest) return null;
        const to = driverPoints.get(closest.driverId);
        if (!to) {
          if (closest.latitude != null && closest.longitude != null) {
            const point = toGrid(city, closest.latitude, closest.longitude);
            return {
              id: row.rideId,
              fromX: from.x,
              fromY: from.y,
              toX: point.x,
              toY: point.y,
              fromLat: from.lat,
              fromLng: from.lng,
              toLat: closest.latitude,
              toLng: closest.longitude,
              ok: closest.canSee,
              label: `${closest.km.toFixed(1)} km`,
            };
          }
          return null;
        }
        return {
          id: row.rideId,
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y,
          fromLat: from.lat,
          fromLng: from.lng,
          toLat: to.lat,
          toLng: to.lng,
          ok: closest.canSee,
          label: `${closest.km.toFixed(1)} km`,
        };
      })
      .filter((link): link is NonNullable<typeof link> => Boolean(link));

    return { searchers, links, rows };
  }, [source, looking, seedRides, seedCustomers, seedDrivers, city, markers]);

  const peekDriver: PeekDriver | null = useMemo(() => {
    if (!selected) return null;
    const liveMatch = live.find((d) => d.driverId === selected);
    if (liveMatch) {
      return {
        id: liveMatch.driverId,
        name: liveMatch.name,
        phone: liveMatch.phone,
        status: liveMatch.status,
        online: liveMatch.online,
        city: liveMatch.city,
        latitude: liveMatch.latitude,
        longitude: liveMatch.longitude,
        heading: liveMatch.heading ?? seedHeading(liveMatch.driverId),
        activeRideId: liveMatch.activeRideId,
        poolId: liveMatch.poolId,
        lastSeenAt: liveMatch.lastSeenAt,
        accountStatus: liveMatch.accountStatus,
      };
    }
    const seed = seedDrivers.find((d) => d.id === selected);
    if (!seed) return null;
    const active = seedActiveRide(seed.id);
    return {
      id: seed.id,
      name: seed.name,
      phone: seed.phone,
      status: !seed.online ? "offline" : active?.status === "on_trip" ? "on_trip" : active ? "busy" : "available",
      online: seed.online,
      city: seed.city,
      vehicle: seed.vehicle,
      plate: seed.plate,
      heading: seedHeading(seed.id),
      activeRideId: active?.id ?? null,
      poolId: active?.poolId ?? null,
      rating: seed.rating,
      trips: seed.trips,
      accountStatus: seed.status,
    };
  }, [selected, live, seedDrivers, seedActiveRide]);

  useEffect(() => {
    if (!peekOpen || !peekDriver) {
      setRide(null);
      setRideLoading(false);
      return;
    }

    const seedRide = seedActiveRide(peekDriver.id);
    const rideId = peekDriver.activeRideId || seedRide?.id || null;

    if (!rideId) {
      setRide(null);
      setRideLoading(false);
      return;
    }

    if (!hasApi() || source === "seed") {
      setRide(seedRide);
      setRideLoading(false);
      return;
    }

    let cancelled = false;
    setRideLoading(true);
    void (async () => {
      try {
        const { token } = await adminLogin();
        const remote = await api<ApiRide>(`/rides/${rideId}`, { token });
        if (!cancelled) setRide(mapApiRide(remote));
      } catch {
        if (!cancelled) setRide(seedRide);
      } finally {
        if (!cancelled) setRideLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peekOpen, peekDriver, seedActiveRide, source]);

  function selectDriver(id: string) {
    setSelected(id);
    setSelectedSearcher(null);
    setPeekOpen(true);
  }

  function selectSearcher(id: string) {
    setSelectedSearcher(id);
    const row = searcherOverlays.rows.find((item) => item.rideId === id);
    if (row?.closest?.driverId) setSelected(row.closest.driverId);
  }

  function closePeek() {
    setPeekOpen(false);
  }

  return (
    <Box>
      <PageHeader
        kicker="Operations"
        title="Fleet map"
        lede="Live drivers and customers placing orders. Blue pins are searchers; lines show the closest driver."
        action={
          <Button startIcon={<RefreshIcon />} onClick={() => setTick((n) => n + 1)}>
            Refresh
          </Button>
        }
      />
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}. Showing local seed positions until the API is up.
        </Alert>
      ) : null}
      {actionNote ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionNote("")}>
          {actionNote}
        </Alert>
      ) : null}
      {source === "api" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Live from NestJS · {markers.length} driver{markers.length === 1 ? "" : "s"} · {searcherOverlays.searchers.length} looking for a ride
        </Alert>
      ) : hasApi() && live.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No live pings yet — showing seed cars with demo headings until drivers go online.
        </Alert>
      ) : null}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        {(["abuja", "lagos"] as const).map((id) => (
          <Button key={id} variant={city === id ? "contained" : "outlined"} onClick={() => setCity(id)}>
            {cityLabel(id)}
          </Button>
        ))}
        <Button variant={onlineOnly ? "contained" : "outlined"} onClick={() => setOnlineOnly((value) => !value)}>
          {onlineOnly ? "Online only" : "All drivers"}
        </Button>
        {([
          { id: "both" as const, label: "Both" },
          { id: "customers" as const, label: "Customers only" },
          { id: "drivers" as const, label: "Drivers only" },
        ]).map((layer) => (
          <Button key={layer.id} variant={mapLayer === layer.id ? "contained" : "outlined"} onClick={() => setMapLayer(layer.id)}>
            {layer.label}
          </Button>
        ))}
        <Button
          variant={showDeliveryZones ? "contained" : "outlined"}
          onClick={() => setShowDeliveryZones((value) => !value)}
        >
          {showDeliveryZones ? "Delivery zones on" : "Delivery zones off"}
        </Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) minmax(280px, 0.7fr)" }, gap: 2 }}>
        <FleetMap
          city={city}
          selected={selected}
          selectedSearcher={selectedSearcher}
          onSelect={selectDriver}
          onSelectSearcher={selectSearcher}
          regions={[
            ...rideZones.filter((zone) => zone.city === city).map((zone) => ({ ...zone, kind: "ride" as const })),
            ...(showDeliveryZones
              ? deliveryZones.filter((zone) => zone.city === city).map((zone) => ({ ...zone, kind: "delivery" as const }))
              : []),
          ]}
          markers={
            mapLayer === "customers"
              ? []
              : markers.map((m) => ({
                  id: m.id,
                  name: m.name,
                  x: m.x,
                  y: m.y,
                  lat: m.lat,
                  lng: m.lng,
                  online: m.online,
                  status: m.status,
                  heading: m.heading,
                  along: m.along,
                  poolTaken: m.poolTaken,
                  poolTotal: m.poolTotal,
                }))
          }
          searchers={mapLayer === "drivers" ? [] : searcherOverlays.searchers}
          links={mapLayer === "both" ? searcherOverlays.links : []}
        />
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "auto", maxHeight: { lg: 560 } }}>
          <Typography sx={{ px: 2, pt: 2, fontWeight: 700 }}>Current locations</Typography>
          <Typography color="text.secondary" sx={{ px: 2, pb: 1, fontSize: 13 }}>
            Showing {mapLayer === "both" ? "drivers and customers" : mapLayer === "customers" ? "customers only" : "drivers only"} · {markers.filter((d) => d.online).length} online · {searcherOverlays.searchers.length} searching
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Driver</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Zone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {markers.map((driver) => {
                const zone = [...rideZones, ...deliveryZones].find(
                  (item) =>
                    item.city === city &&
                    item.active &&
                    inside({ x: driver.x, y: driver.y }, ring(item.cx, item.cy, item.rx, item.ry)),
                );
                return (
                  <TableRow key={driver.id} hover selected={selected === driver.id} onClick={() => selectDriver(driver.id)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      {driver.name}
                      {driver.along && (driver.poolTaken ?? 0) > 0 ? (
                        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                          Along · {driver.poolTaken}/{driver.poolTotal ?? 3} riders
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Pill tone={statusTone(driver.status)}>{titleCase(driver.status)}</Pill>
                    </TableCell>
                    <TableCell>{zone?.name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {peekDriver && !peekOpen ? (
            <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography sx={{ fontWeight: 700 }}>{peekDriver.name}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                {peekDriver.phone} · {peekDriver.status}
                {formatBearing(peekDriver.heading) ? ` · ${formatBearing(peekDriver.heading)}` : ""}
              </Typography>
              <Button size="small" sx={{ mt: 1 }} onClick={() => setPeekOpen(true)}>
                Open details
              </Button>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box sx={{ mt: 2, border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "hidden" }}>
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Looking for a ride</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            Searchers in {cityLabel(city)}. If the closest driver is outside their trip range, extend it so the offer can reach them.
          </Typography>
        </Box>
        {looking.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2, pb: 2, fontSize: 13 }}>
            {hasApi() ? "No customers are searching right now." : "Connect the API to see live searchers."}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Pickup</TableCell>
                <TableCell>Waiting</TableCell>
                <TableCell>Closest driver</TableCell>
                <TableCell>Range</TableCell>
                <TableCell align="right">Help</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(looking.length ? looking : searcherOverlays.rows).map((row) => {
                const closest = row.closest;
                const blocked = closest && !closest.canSee;
                return (
                  <TableRow
                    key={row.rideId}
                    hover
                    selected={selectedSearcher === row.rideId}
                    onClick={() => selectSearcher(row.rideId)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{row.customer?.name || "Customer"}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                        {row.customer?.phone || "—"} · {naira(row.fare)}
                        {row.position?.source === "live" ? " · live pin" : ""}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13 }}>{row.pickup.label || "Pickup"}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                        → {row.dropoff.label || "Dropoff"}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatWait(row.waitingMs)}</TableCell>
                    <TableCell>
                      {closest ? (
                        <>
                          <Typography sx={{ fontSize: 13 }}>{closest.name}</Typography>
                          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                            {closest.km.toFixed(1)} km away
                          </Typography>
                        </>
                      ) : (
                        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                          No available driver
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {closest ? (
                        <Pill tone={closest.canSee ? "ok" : "warn"}>
                          {closest.canSee
                            ? `Sees · ${closest.effectiveRadiusKm} km`
                            : `Blocked · needs ${closest.shortfallKm + closest.effectiveRadiusKm} km`}
                        </Pill>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                      <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {blocked && closest ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={extending === row.rideId}
                            onClick={() => void extendClosest(row)}
                          >
                            {extending === row.rideId ? "Extending…" : `Extend range`}
                          </Button>
                        ) : null}
                        {hasApi() ? (
                          <Button size="small" variant="contained" onClick={() => openAssign(row, closest?.driverId)}>
                            Assign driver
                          </Button>
                        ) : null}
                        {closest?.canSee ? (
                          <Button size="small" onClick={() => selectDriver(closest.driverId)}>
                            View
                          </Button>
                        ) : null}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>

      <DriverPeek open={peekOpen} driver={peekDriver} ride={ride} rideLoading={rideLoading} onClose={closePeek} />

      <Dialog open={Boolean(assignRow)} onClose={() => !assigning && setAssignRow(null)} fullWidth maxWidth="xs">
        <DialogTitle>Assign to a driver</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 1 }}>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {assignRow?.customer?.name || "Customer"} · {assignRow?.pickup.label || "Pickup"} → {assignRow?.dropoff.label || "Dropoff"}
          </Typography>
          <TextField
            select
            label="Driver"
            value={assignDriverId}
            onChange={(event) => setAssignDriverId(event.target.value)}
            fullWidth
          >
            {assignChoices.length === 0 ? (
              <MenuItem value="" disabled>
                No online drivers in {cityLabel(city)}
              </MenuItem>
            ) : (
              assignChoices.map((choice) => (
                <MenuItem key={choice.id} value={choice.id}>
                  {choice.label}
                </MenuItem>
              ))
            )}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignRow(null)} disabled={assigning}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirmAssign()} disabled={!assignDriverId || assigning}>
            {assigning ? "Assigning…" : "Assign"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function formatWait(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}
