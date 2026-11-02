"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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
import { useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Ride, RideStatus } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const statuses: RideStatus[] = ["searching", "assigned", "on_trip", "completed", "cancelled"];

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
  const name = (id: string | null, pool: { id: string; name: string }[]) => pool.find((item) => item.id === id)?.name ?? "Unassigned";
  const patch = (partial: Partial<Ride>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  return (
    <Box>
      <PageHeader kicker="Live" title="Rides" lede="City trips on the desk. Status, distance, class, and who is on the trip." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft({ id: uid("r"), city: "abuja", customerId: customers[0]?.id ?? "", driverId: null, classId: "ryde", pickup: "", dropoff: "", distanceKm: 5, fare: 1800, status: "searching", when: "Just now" }); }}>Add ride</Button> : null} />
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
            {rides.map((ride) => (
              <TableRow key={ride.id} hover>
                <TableCell>{ride.when}<Box sx={{ color: "text.secondary", fontSize: 12 }}>{cityLabel(ride.city)} · {classes.find((item) => item.id === ride.classId)?.label}</Box></TableCell>
                <TableCell>{ride.pickup} → {ride.dropoff}</TableCell>
                <TableCell>{name(ride.customerId, customers)}<Box sx={{ color: "text.secondary", fontSize: 12 }}>{name(ride.driverId, drivers)}</Box></TableCell>
                <TableCell>{ride.distanceKm} km</TableCell>
                <TableCell>{naira(ride.fare)}</TableCell>
                <TableCell><Pill tone={ride.status === "cancelled" ? "hot" : ride.status === "completed" ? "off" : "ok"}>{titleCase(ride.status)}</Pill></TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label="Edit ride" onClick={() => { setCreating(false); setDraft({ ...ride }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label="Delete ride" onClick={() => setRemoveId(ride.id)}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor open={Boolean(draft)} title={creating ? "New ride" : "Edit ride"} onClose={() => setDraft(null)} onSave={() => { if (!draft || !draft.pickup.trim() || !draft.dropoff.trim()) return; saveRide({ ...draft, distanceKm: Number(draft.distanceKm) || 0, fare: Number(draft.fare) || 0 }, creating); setDraft(null); }}>
        {draft ? (
          <>
            <TextField select label="City" value={draft.city} onChange={(event) => patch({ city: event.target.value as Ride["city"] })}>
              <MenuItem value="abuja">Abuja</MenuItem>
              <MenuItem value="lagos">Lagos</MenuItem>
            </TextField>
            <TextField label="Pickup" value={draft.pickup} onChange={(event) => patch({ pickup: event.target.value })} />
            <TextField label="Dropoff" value={draft.dropoff} onChange={(event) => patch({ dropoff: event.target.value })} />
            <TextField select label="Customer" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
              {customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}
            </TextField>
            <TextField select label="Driver" value={draft.driverId ?? ""} onChange={(event) => patch({ driverId: event.target.value || null })}>
              <MenuItem value="">Unassigned</MenuItem>
              {drivers.filter((driver) => driver.city === draft.city).map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.name}</MenuItem>)}
            </TextField>
            <TextField select label="Class" value={draft.classId} onChange={(event) => patch({ classId: event.target.value as Ride["classId"] })}>
              {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
            </TextField>
            <TextField label="Distance (km)" type="number" value={draft.distanceKm} onChange={(event) => patch({ distanceKm: Number(event.target.value) })} />
            <TextField label="Fare (₦)" type="number" value={draft.fare} onChange={(event) => patch({ fare: Number(event.target.value) })} />
            <TextField select label="Status" value={draft.status} onChange={(event) => patch({ status: event.target.value as RideStatus })}>
              {statuses.map((status) => <MenuItem key={status} value={status}>{titleCase(status)}</MenuItem>)}
            </TextField>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this ride?" body="The trip leaves the operations list." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeRide(removeId); setRemoveId(null); }} />
    </Box>
  );
}
