"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { adminLogin, api, hasApi } from "@/lib/api";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Ride, RideStatus } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const statuses: RideStatus[] = ["searching", "assigned", "on_trip", "completed", "cancelled"];

type SessionRow = {
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

function labelOf(place: SessionRow["pickup"]) {
  return typeof place === "string" ? place : place?.label || "";
}

function whenOf(ride: SessionRow) {
  if (!ride.createdAt) return "—";
  return new Date(ride.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export function RidesView() {
  const edit = useEdit();
  const rides = useAdminStore((state) => state.rides);
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const classes = useAdminStore((state) => state.pricing.classes);
  const saveRide = useAdminStore((state) => state.saveRide);
  const removeRide = useAdminStore((state) => state.removeRide);
  const [draft, setDraft] = useState<Ride | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [source, setSource] = useState<"api" | "local">("local");
  const [error, setError] = useState("");
  const name = (id: string | null, pool: { id: string; name: string }[]) => pool.find((item) => item.id === id)?.name ?? "Unassigned";
  const patch = (partial: Partial<Ride>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  const loadSessions = useCallback(async () => {
    if (!hasApi()) {
      setSessions([]);
      setSource("local");
      return;
    }
    try {
      setError("");
      const { token } = await adminLogin();
      const rows = await api<SessionRow[]>("/rides?limit=100", { token });
      setSessions(rows);
      // Empty live table → show desk seed so ops can still browse Along / demo trips.
      setSource(rows.length > 0 ? "api" : "local");
    } catch (err) {
      setSessions([]);
      setSource("local");
      setError(err instanceof Error ? err.message : "Could not load ride sessions");
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const apiMode = source === "api" && sessions.length > 0;

  return (
    <Box>
      <PageHeader
        kicker="Live"
        title="Rides"
        lede="Each ride session keeps customer, driver, pickup/dropoff coords, fare, status history, and latest locations."
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            {hasApi() ? (
              <Button startIcon={<RefreshIcon />} onClick={() => void loadSessions()}>
                Refresh sessions
              </Button>
            ) : null}
            {edit && !apiMode ? (
              <Button
                variant="contained"
                onClick={() => {
                  setCreating(true);
                  setDraft({
                    id: uid("r"),
                    city: "abuja",
                    customerId: customers[0]?.id ?? "",
                    driverId: null,
                    classId: "ryde",
                    pickup: "",
                    dropoff: "",
                    distanceKm: 5,
                    fare: 1800,
                    status: "searching",
                    when: "Just now",
                  });
                }}
              >
                Add ride
              </Button>
            ) : null}
          </Box>
        }
      />
      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}. Showing dummy desk rides.
        </Alert>
      ) : null}
      {apiMode ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Live from NestJS ride sessions ({sessions.length}). Open a row for full detail.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          No live sessions yet — showing dummy desk rides (including Amaka’s Along trip with 2 riders).
        </Alert>
      )}

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
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {apiMode
              ? sessions.map((ride) => (
                  <TableRow key={ride.id} hover selected={selected?.id === ride.id} onClick={() => setSelected(ride)} sx={{ cursor: "pointer" }}>
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
                      <Pill tone={ride.status === "cancelled" ? "hot" : ride.status === "completed" ? "off" : "ok"}>{titleCase(ride.status)}</Pill>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : rides.map((ride) => (
                  <TableRow key={ride.id} hover>
                    <TableCell>
                      {ride.when}
                      <Box sx={{ color: "text.secondary", fontSize: 12 }}>
                        {cityLabel(ride.city)} · {classes.find((item) => item.id === ride.classId)?.label || titleCase(ride.classId)}
                        {ride.along ? ` · ${ride.riders?.length ?? 0}/${ride.seatsTotal ?? 3} seats` : ""}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {ride.along && ride.riders?.length
                        ? ride.riders.map((rider) => `${rider.pickup} → ${rider.dropoff}`).join(" · ")
                        : `${ride.pickup} → ${ride.dropoff}`}
                    </TableCell>
                    <TableCell>
                      {ride.along && ride.riders?.length
                        ? ride.riders.map((rider) => rider.name).join(" + ")
                        : name(ride.customerId, customers)}
                      <Box sx={{ color: "text.secondary", fontSize: 12 }}>{name(ride.driverId, drivers)}</Box>
                    </TableCell>
                    <TableCell>{ride.distanceKm} km</TableCell>
                    <TableCell>{naira(ride.fare)}</TableCell>
                    <TableCell>
                      <Pill tone={ride.status === "cancelled" ? "hot" : ride.status === "completed" ? "off" : "ok"}>{titleCase(ride.status)}</Pill>
                    </TableCell>
                    <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                      <IconButton
                        aria-label="Edit ride"
                        onClick={() => {
                          setCreating(false);
                          setDraft({ ...ride });
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                      <IconButton aria-label="Delete ride" onClick={() => setRemoveId(ride.id)}>
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Box>

      {selected ? (
        <Box sx={{ mt: 2, p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.5 }}>
          <Typography variant="h3">Session {selected.id}</Typography>
          <Typography color="text.secondary">
            Status {selected.status} · Payment {selected.payment || "cash"} · Quoted {naira(selected.quoted || selected.fare)} · Fare {naira(selected.fare)}
            {selected.earnings != null ? ` · Driver earnings ${naira(selected.earnings)}` : ""}
          </Typography>
          <Typography>
            Customer: {selected.customer?.name} ({selected.customer?.phone || selected.customerId})
          </Typography>
          <Typography>
            Driver: {selected.driver?.name || "Unassigned"} {selected.driver?.phone ? `(${selected.driver.phone})` : ""}
          </Typography>
          <Typography>
            Pickup {labelOf(selected.pickup)}
            {typeof selected.pickup !== "string" ? ` · ${selected.pickup.latitude.toFixed(4)}, ${selected.pickup.longitude.toFixed(4)}` : ""}
          </Typography>
          <Typography>
            Dropoff {labelOf(selected.dropoff)}
            {typeof selected.dropoff !== "string" ? ` · ${selected.dropoff.latitude.toFixed(4)}, ${selected.dropoff.longitude.toFixed(4)}` : ""}
          </Typography>
          {selected.driverLocation ? (
            <Typography color="text.secondary">
              Driver last seen {selected.driverLocation.latitude.toFixed(4)}, {selected.driverLocation.longitude.toFixed(4)}
              {selected.driverLocation.at ? ` · ${new Date(selected.driverLocation.at).toLocaleTimeString()}` : ""}
            </Typography>
          ) : null}
          {selected.customerLocation ? (
            <Typography color="text.secondary">
              Customer last seen {selected.customerLocation.latitude.toFixed(4)}, {selected.customerLocation.longitude.toFixed(4)}
            </Typography>
          ) : null}
          {selected.statusHistory?.length ? (
            <Box>
              <Typography fontWeight={700}>Status history</Typography>
              {selected.statusHistory.map((event, index) => (
                <Typography key={`${event.at}-${index}`} color="text.secondary" sx={{ fontSize: 13 }}>
                  {new Date(event.at).toLocaleString()} · {event.status}
                  {event.note ? ` · ${event.note}` : ""}
                </Typography>
              ))}
            </Box>
          ) : null}
          <Button onClick={() => setSelected(null)}>Close detail</Button>
        </Box>
      ) : null}

      <Editor
        open={Boolean(draft)}
        title={creating ? "New ride" : "Edit ride"}
        onClose={() => setDraft(null)}
        onSave={() => {
          if (!draft || !draft.pickup.trim() || !draft.dropoff.trim()) return;
          saveRide({ ...draft, distanceKm: Number(draft.distanceKm) || 0, fare: Number(draft.fare) || 0 }, creating);
          setDraft(null);
        }}
      >
        {draft ? (
          <>
            <TextField select label="City" value={draft.city} onChange={(event) => patch({ city: event.target.value as Ride["city"] })}>
              <MenuItem value="abuja">Abuja</MenuItem>
              <MenuItem value="lagos">Lagos</MenuItem>
            </TextField>
            <TextField label="Pickup" value={draft.pickup} onChange={(event) => patch({ pickup: event.target.value })} />
            <TextField label="Dropoff" value={draft.dropoff} onChange={(event) => patch({ dropoff: event.target.value })} />
            <TextField select label="Customer" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Driver" value={draft.driverId ?? ""} onChange={(event) => patch({ driverId: event.target.value || null })}>
              <MenuItem value="">Unassigned</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driver.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Class" value={draft.classId} onChange={(event) => patch({ classId: event.target.value as Ride["classId"] })}>
              {classes.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Distance km" type="number" value={draft.distanceKm} onChange={(event) => patch({ distanceKm: Number(event.target.value) })} />
            <TextField label="Fare" type="number" value={draft.fare} onChange={(event) => patch({ fare: Number(event.target.value) })} />
            <TextField select label="Status" value={draft.status} onChange={(event) => patch({ status: event.target.value as RideStatus })}>
              {statuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {titleCase(status)}
                </MenuItem>
              ))}
            </TextField>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this ride?" onCancel={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeRide(removeId); setRemoveId(null); }} />
    </Box>
  );
}
