"use client";

import CloseIcon from "@mui/icons-material/Close";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
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
  riders?: Array<{ name: string; pickup: string; dropoff: string; fare: number }>;
};

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
