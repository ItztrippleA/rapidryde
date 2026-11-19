"use client";

import CloseIcon from "@mui/icons-material/Close";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import PersonIcon from "@mui/icons-material/Person";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { Pill } from "@/components/ui/Chrome";
import { naira, titleCase } from "@/lib/format";

export type PeekDriver = {
  id: string;
  name: string;
  phone?: string;
  status: "offline" | "available" | "on_trip" | "busy";
  online: boolean;
  city?: string | null;
  vehicle?: string;
  plate?: string;
  latitude?: number | null;
  longitude?: number | null;
  heading?: number | null;
  activeRideId?: string | null;
  poolId?: string | null;
  lastSeenAt?: number | null;
  accountStatus?: string;
  rating?: number;
  trips?: number;
};

export type PeekRide = {
  id: string;
  status: string;
  classLabel?: string;
  classId?: string;
  payment?: string;
  fare?: number;
  quoted?: number;
  earnings?: number;
  plannedKm?: number;
  plannedMinutes?: number;
  pickup: string;
  dropoff: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  startedAt?: number | null;
  assignedAt?: number | null;
  when?: string;
  along?: boolean;
  poolId?: string;
  seatsTotal?: number;
  riders?: Array<{
    name: string;
    pickup: string;
    dropoff: string;
    fare: number;
    seatIndex?: number;
    seatLabel?: string;
  }>;
};

const CABIN_SLOTS = [
  { id: "front", index: 0, short: "Front" },
  { id: "rear_left", index: 1, short: "Rear L" },
  { id: "rear_right", index: 2, short: "Rear R" },
] as const;

/** Mirrors customer `CabinPicker` — top-down car with driver + 3 passenger seats. */
function CabinSeats({
  riders,
  seatsTotal = 3,
  colour = "#5B7FA8",
}: {
  riders: NonNullable<PeekRide["riders"]>;
  seatsTotal?: number;
  colour?: string;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const paper = dark ? "#1A160F" : "#F8F6EF";
  const ink = dark ? "#F6F1E6" : "#1A160C";
  const muted = dark ? "#A39888" : "#6B6256";
  const line = dark ? "#3A3228" : "#D9D1C3";
  const bySeat = new Map(riders.map((rider, index) => [rider.seatIndex ?? index + 1, rider]));
  const slots = CABIN_SLOTS.slice(0, seatsTotal);

  return (
    <Box sx={{ mt: 0.5, mb: 1, display: "grid", justifyItems: "center", gap: 1.25 }}>
      <Typography
        sx={{
          alignSelf: "stretch",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        Cabin seats
      </Typography>

      <Box sx={{ position: "relative", width: 220, height: 280 }}>
        <Box
          component="svg"
          viewBox="0 0 220 280"
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          aria-hidden
        >
          <ellipse cx="110" cy="268" rx="70" ry="8" fill="rgba(0,0,0,0.1)" />
          <path
            d="M48 54 C48 28, 70 14, 110 14 C150 14, 172 28, 172 54 L178 210 C178 242, 152 262, 110 262 C68 262, 42 242, 42 210 Z"
            fill={colour}
          />
          <path d="M62 42 C78 28, 142 28, 158 42 L152 64 H68 Z" fill="rgba(215,232,245,0.9)" />
          <path d="M56 210 L164 210 L158 246 C146 254, 74 254, 62 246 Z" fill="rgba(0,0,0,0.12)" />
          <rect x="70" y="78" width="80" height="10" rx="4" fill="rgba(255,255,255,0.28)" />
          <rect x="44" y="96" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <rect x="166" y="96" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <rect x="44" y="168" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <rect x="166" y="168" width="10" height="36" rx="4" fill="rgba(0,0,0,0.2)" />
          <path d="M110 70 V250" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="4 6" />
        </Box>

        <Box sx={{ position: "absolute", top: 74, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3.5 }}>
          <CabinSeatChip
            label="Driver"
            state="driver"
            ink="#F6E7C1"
            fill="rgba(26,20,12,0.55)"
            border="transparent"
          />
          <CabinSeatChip
            label={bySeat.get(0)?.name.split(" ")[0] || "Front"}
            state={bySeat.has(0) ? "taken" : "open"}
            ink={bySeat.has(0) ? muted : ink}
            fill={bySeat.has(0) ? "rgba(26,20,12,0.35)" : paper}
            border={bySeat.has(0) ? "transparent" : line}
          />
        </Box>

        <Box sx={{ position: "absolute", top: 168, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3.5 }}>
          {slots
            .filter((slot) => slot.index > 0)
            .map((slot) => {
              const rider = bySeat.get(slot.index);
              return (
                <CabinSeatChip
                  key={slot.id}
                  label={rider ? rider.name.split(" ")[0] : slot.short}
                  state={rider ? "taken" : "open"}
                  ink={rider ? muted : ink}
                  fill={rider ? "rgba(26,20,12,0.35)" : paper}
                  border={rider ? "transparent" : line}
                />
              );
            })}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
        <Legend swatch="rgba(26,20,12,0.35)" label="Taken" />
        <Legend swatch={paper} label="Open" border={line} />
        <Legend swatch="rgba(26,20,12,0.55)" label="Driver" />
      </Box>
    </Box>
  );
}

function CabinSeatChip({
  label,
  state,
  ink,
  fill,
  border,
}: {
  label: string;
  state: "driver" | "taken" | "open";
  ink: string;
  fill: string;
  border: string;
}) {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: "14px",
        bgcolor: fill,
        border: state === "open" ? `1px solid ${border}` : `1px solid ${border}`,
        display: "grid",
        placeItems: "center",
        gap: 0.15,
        opacity: state === "taken" ? 0.85 : 1,
      }}
    >
      {state === "open" ? (
        <PersonOutlinedIcon sx={{ fontSize: 18, color: ink }} />
      ) : (
        <PersonIcon sx={{ fontSize: 18, color: ink }} />
      )}
      <Typography sx={{ color: ink, fontSize: 9, fontWeight: 800, lineHeight: 1.1 }}>
        {state === "taken" ? "Taken" : label}
      </Typography>
      {state === "taken" ? (
        <Typography sx={{ color: ink, fontSize: 8, fontWeight: 700, lineHeight: 1 }}>{label}</Typography>
      ) : null}
    </Box>
  );
}

function Legend({ swatch, label, border }: { swatch: string; label: string; border?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "4px",
          bgcolor: swatch,
          border: border ? `1px solid ${border}` : "none",
        }}
      />
      <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
  );
}

function statusTone(status: PeekDriver["status"]) {
  if (status === "on_trip") return "ok" as const;
  if (status === "busy") return "warn" as const;
  if (status === "available") return "ok" as const;
  return "off" as const;
}

function rideTone(status: string) {
  if (status === "on_trip" || status === "arrived" || status === "to_pickup") return "ok" as const;
  if (status === "assigned" || status === "searching") return "warn" as const;
  if (status === "cancelled" || status === "timeout" || status === "no_drivers") return "hot" as const;
  return "off" as const;
}

function formatBearing(heading: number | null | undefined) {
  if (heading == null || !Number.isFinite(heading)) return null;
  const deg = ((heading % 360) + 360) % 360;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${labels[index]}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 1, py: 0.55 }}>
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

export function DriverPeek({
  open,
  driver,
  ride,
  rideLoading,
  onClose,
}: {
  open: boolean;
  driver: PeekDriver | null;
  ride: PeekRide | null;
  rideLoading?: boolean;
  onClose: () => void;
}) {
  if (!driver) return null;
  const bearing = formatBearing(driver.heading);
  const onTrip = driver.status === "on_trip" || driver.status === "busy" || Boolean(driver.activeRideId) || Boolean(ride);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
        <DirectionsCarFilledOutlinedIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h2" sx={{ fontSize: 20 }}>
            {driver.name}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {driver.phone || "No phone"}
            {driver.city ? ` · ${titleCase(driver.city)}` : ""}
          </Typography>
        </Box>
        <Pill tone={statusTone(driver.status)}>{titleCase(driver.status)}</Pill>
        <IconButton aria-label="Close driver details" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "grid", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", mb: 0.5 }}>
            Driver
          </Typography>
          <Row label="Online" value={driver.online ? "Yes" : "No"} />
          <Row label="Vehicle" value={driver.vehicle} />
          <Row label="Plate" value={driver.plate} />
          <Row label="Account" value={driver.accountStatus ? titleCase(driver.accountStatus) : null} />
          <Row label="Rating" value={driver.rating != null ? driver.rating.toFixed(2) : null} />
          <Row label="Trips" value={driver.trips != null ? String(driver.trips) : null} />
          <Row
            label="Location"
            value={
              driver.latitude != null && driver.longitude != null
                ? `${driver.latitude.toFixed(5)}, ${driver.longitude.toFixed(5)}`
                : null
            }
          />
          <Row label="Heading" value={bearing} />
          <Row
            label="Last seen"
            value={driver.lastSeenAt ? new Date(driver.lastSeenAt).toLocaleString() : null}
          />
          <Row label="Pool" value={driver.poolId} />
        </Box>

        {onTrip ? (
          <Box
            sx={{
              p: 1.5,
              borderRadius: "8px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              display: "grid",
              gap: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <RouteOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography sx={{ fontWeight: 700, flex: 1 }}>Active ride</Typography>
              {ride ? <Pill tone={rideTone(ride.status)}>{titleCase(ride.status)}</Pill> : null}
            </Box>
            {rideLoading ? (
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                Loading ride…
              </Typography>
            ) : ride ? (
              <>
                <Row label="Ride" value={ride.id} />
                <Row
                  label="Class"
                  value={
                    ride.along
                      ? `Along · ${ride.riders?.length ?? 0}/${ride.seatsTotal ?? 3} seats`
                      : ride.classLabel || ride.classId
                  }
                />
                <Row label="Pool" value={ride.poolId} />
                {ride.riders && ride.riders.length > 0 ? (
                  <Box sx={{ mt: 0.5, mb: 0.5, display: "grid", gap: 1 }}>
                    <CabinSeats riders={ride.riders} seatsTotal={ride.seatsTotal ?? 3} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
                      Riders in car
                    </Typography>
                    {ride.riders.map((rider, index) => (
                      <Box
                        key={`${rider.name}-${index}`}
                        sx={{
                          p: 1,
                          borderRadius: "8px",
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.paper",
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          {index + 1}. {rider.name}
                          {rider.seatLabel ? ` · ${rider.seatLabel}` : ""}
                        </Typography>
                        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                          {rider.pickup} → {rider.dropoff}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, mt: 0.25 }}>{naira(rider.fare)}</Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <>
                    <Row label="Customer" value={ride.customerName} />
                    <Row label="Phone" value={ride.customerPhone} />
                    <Row label="Pickup" value={ride.pickup} />
                    <Row label="Dropoff" value={ride.dropoff} />
                  </>
                )}
                <Row
                  label="Distance"
                  value={
                    ride.plannedKm != null
                      ? `${ride.plannedKm.toFixed(1)} km${ride.plannedMinutes != null ? ` · ${ride.plannedMinutes} min` : ""}`
                      : null
                  }
                />
                <Row label="Pool fare" value={ride.fare != null ? naira(ride.fare) : null} />
                <Row label="Quoted" value={ride.quoted != null && ride.quoted !== ride.fare ? naira(ride.quoted) : null} />
                <Row label="Earnings" value={ride.earnings != null ? naira(ride.earnings) : null} />
                <Row label="Payment" value={ride.payment ? titleCase(ride.payment) : null} />
                <Row label="Note" value={ride.note} />
                <Row
                  label="Started"
                  value={
                    ride.when ||
                    (ride.startedAt ? new Date(ride.startedAt).toLocaleString() : null) ||
                    (ride.assignedAt ? new Date(ride.assignedAt).toLocaleString() : null)
                  }
                />
              </>
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                {driver.activeRideId
                  ? `Ride ${driver.activeRideId} is linked, but details are unavailable.`
                  : "No ride session attached yet."}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            Not on a trip right now.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
