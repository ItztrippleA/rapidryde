"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { naira, titleCase } from "@/lib/format";

export type SessionRow = {
  id: string;
  status: string;
  city?: string;
  classId?: string;
  classLabel?: string;
  pickup: { label: string; latitude: number; longitude: number } | string;
  dropoff: { label: string; latitude: number; longitude: number } | string;
  customer?: { id: string; name: string; phone: string };
  driver?: { id: string; name: string; phone: string } | null;
  customerId?: string;
  driverId?: string | null;
  plannedKm?: number;
  fare: number;
  quoted?: number;
  earnings?: number;
  payment?: string;
  driverLocation?: { latitude: number; longitude: number; at?: number } | null;
  customerLocation?: { latitude: number; longitude: number; at?: number } | null;
  statusHistory?: Array<{ status: string; at: number; note?: string }>;
  createdAt?: number;
  updatedAt?: number;
};

export function labelOf(place: SessionRow["pickup"]) {
  return typeof place === "string" ? place : place?.label || "";
}

export function whenOf(ride: Pick<SessionRow, "createdAt">) {
  if (!ride.createdAt) return "—";
  return new Date(ride.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string): "ok" | "warn" | "hot" | "off" {
  if (status === "cancelled") return "hot";
  if (status === "completed") return "off";
  if (status === "searching") return "warn";
  return "ok";
}

export function RideDetailDialog({
  ride,
  onClose,
}: {
  ride: SessionRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(ride)} onClose={onClose} fullWidth maxWidth="sm">
      {ride ? (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, pr: 2 }}>
            <Box>
              <Typography variant="h2" component="span">
                Ride details
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.4, fontFamily: "ui-monospace, monospace" }}>
                {ride.id}
              </Typography>
            </Box>
            <Pill tone={statusTone(ride.status)}>{titleCase(ride.status)}</Pill>
          </DialogTitle>
          <DialogContent dividers sx={{ display: "grid", gap: 1.5 }}>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              {whenOf(ride)} · {ride.city || "abuja"} · {ride.classLabel || ride.classId || "—"}
            </Typography>
            <Typography sx={{ fontSize: 14 }}>
              Payment {ride.payment || "cash"} · Quoted {naira(ride.quoted || ride.fare)} · Fare {naira(ride.fare)}
              {ride.earnings != null ? ` · Driver earnings ${naira(ride.earnings)}` : ""}
              {ride.plannedKm != null ? ` · ${ride.plannedKm} km` : ""}
            </Typography>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.4 }}>People</Typography>
              <Typography sx={{ fontSize: 14 }}>
                Customer: {ride.customer?.name || "—"} ({ride.customer?.phone || ride.customerId || "—"})
              </Typography>
              <Typography sx={{ fontSize: 14 }}>
                Driver: {ride.driver?.name || "Unassigned"}
                {ride.driver?.phone ? ` (${ride.driver.phone})` : ride.driverId ? ` (${ride.driverId})` : ""}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.4 }}>Route</Typography>
              <Typography sx={{ fontSize: 14 }}>
                Pickup {labelOf(ride.pickup)}
                {typeof ride.pickup !== "string" && ride.pickup?.latitude
                  ? ` · ${ride.pickup.latitude.toFixed(4)}, ${ride.pickup.longitude.toFixed(4)}`
                  : ""}
              </Typography>
              <Typography sx={{ fontSize: 14 }}>
                Dropoff {labelOf(ride.dropoff)}
                {typeof ride.dropoff !== "string" && ride.dropoff?.latitude
                  ? ` · ${ride.dropoff.latitude.toFixed(4)}, ${ride.dropoff.longitude.toFixed(4)}`
                  : ""}
              </Typography>
            </Box>
            {ride.driverLocation ? (
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                Driver last seen {ride.driverLocation.latitude.toFixed(4)}, {ride.driverLocation.longitude.toFixed(4)}
                {ride.driverLocation.at ? ` · ${new Date(ride.driverLocation.at).toLocaleTimeString()}` : ""}
              </Typography>
            ) : null}
            {ride.customerLocation ? (
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                Customer last seen {ride.customerLocation.latitude.toFixed(4)},{" "}
                {ride.customerLocation.longitude.toFixed(4)}
              </Typography>
            ) : null}
            {ride.statusHistory?.length ? (
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.6 }}>Status history</Typography>
                <Box sx={{ display: "grid", gap: 0.4 }}>
                  {ride.statusHistory.map((event, index) => (
                    <Typography key={`${event.at}-${index}`} color="text.secondary" sx={{ fontSize: 13 }}>
                      {new Date(event.at).toLocaleString()} · {event.status}
                      {event.note ? ` · ${event.note}` : ""}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button onClick={onClose} variant="contained">
              Close
            </Button>
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}

export function RidesView() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(hasApi());
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    if (!hasApi()) {
      setSessions([]);
      setLoading(false);
      setError("API URL is not configured.");
      return;
    }
    setLoading(true);
    try {
      setError("");
      const { token } = await adminLogin();
      const rows = await api<SessionRow[]>("/rides?limit=100", { token });
      setSessions(rows);
    } catch (err) {
      setSessions([]);
      setError(err instanceof Error ? err.message : "Could not load ride sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <Box>
      <PageHeader
        kicker="Live"
        title="Rides"
        lede="Live ride sessions from the API — customer, driver, fare, status history, and latest locations."
        action={
          hasApi() ? (
            <Button startIcon={<RefreshIcon />} onClick={() => void loadSessions()} disabled={loading}>
              Refresh
            </Button>
          ) : null
        }
      />
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {!loading && !error && sessions.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No ride sessions yet. They appear here when customers book.
        </Alert>
      ) : null}

      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>People</TableCell>
              <TableCell>Distance</TableCell>
              <TableCell>Fare</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading sessions…</TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No rides to show.</TableCell>
              </TableRow>
            ) : (
              sessions.map((ride) => (
                <TableRow key={ride.id} hover onClick={() => setSelected(ride)} sx={{ cursor: "pointer" }}>
                  <TableCell>
                    {whenOf(ride)}
                    <Box sx={{ color: "text.secondary", fontSize: 12 }}>
                      {ride.city || "abuja"} · {ride.classLabel || ride.classId}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {labelOf(ride.pickup)} → {labelOf(ride.dropoff)}
                  </TableCell>
                  <TableCell>
                    {ride.customer?.name || ride.customerId}
                    <Box sx={{ color: "text.secondary", fontSize: 12 }}>{ride.driver?.name || "Unassigned"}</Box>
                  </TableCell>
                  <TableCell>{ride.plannedKm ?? 0} km</TableCell>
                  <TableCell>{naira(ride.fare)}</TableCell>
                  <TableCell>
                    <Pill tone={statusTone(ride.status)}>{titleCase(ride.status)}</Pill>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <RideDetailDialog ride={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
