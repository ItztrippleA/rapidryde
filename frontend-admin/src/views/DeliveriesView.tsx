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
import type { Delivery, DeliveryKind, DeliveryStatus } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const kinds: DeliveryKind[] = ["courier", "freight", "food", "grocery"];
const statuses: DeliveryStatus[] = ["new", "assigned", "picked_up", "delivered", "cancelled"];

export function DeliveriesView() {
  const edit = useEdit();
  const deliveries = useAdminStore((state) => state.deliveries);
  const zones = useAdminStore((state) => state.deliveryZones);
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const saveDelivery = useAdminStore((state) => state.saveDelivery);
  const removeDelivery = useAdminStore((state) => state.removeDelivery);
  const [draft, setDraft] = useState<Delivery | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const patch = (partial: Partial<Delivery>) => setDraft((current) => (current ? { ...current, ...partial } : current));
  const who = (id: string | null, pool: { id: string; name: string }[]) => pool.find((item) => item.id === id)?.name ?? "Unassigned";

  return (
    <Box>
      <PageHeader kicker="Live" title="Deliveries" lede="Courier, freight, food, and grocery on the same desk as rides. Each order sits in a delivery zone." action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft({ id: uid("dl"), kind: "courier", city: "abuja", customerId: customers[0]?.id ?? "", driverId: null, zoneId: zones[0]?.id ?? "", pickup: "", dropoff: "", distanceKm: 4, fee: 1000, status: "new", note: "" }); }}>Add delivery</Button> : null} />
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>Zone</TableCell>
              <TableCell>Distance</TableCell>
              <TableCell>Fee</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 700 }}>{titleCase(delivery.kind)}</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 12 }}>{cityLabel(delivery.city)} · {who(delivery.customerId, customers)}</Box>
                </TableCell>
                <TableCell>{delivery.pickup} → {delivery.dropoff}<Box sx={{ color: "text.secondary", fontSize: 12 }}>{delivery.note}</Box></TableCell>
                <TableCell>{zones.find((zone) => zone.id === delivery.zoneId)?.name ?? "—"}</TableCell>
                <TableCell>{delivery.distanceKm} km</TableCell>
                <TableCell>{naira(delivery.fee)}</TableCell>
                <TableCell><Pill tone={delivery.status === "cancelled" ? "hot" : delivery.status === "delivered" ? "off" : "ok"}>{titleCase(delivery.status)}</Pill></TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label="Edit delivery" onClick={() => { setCreating(false); setDraft({ ...delivery }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label="Delete delivery" onClick={() => setRemoveId(delivery.id)}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor open={Boolean(draft)} title={creating ? "New delivery" : "Edit delivery"} onClose={() => setDraft(null)} onSave={() => { if (!draft || !draft.pickup.trim()) return; saveDelivery({ ...draft, distanceKm: Number(draft.distanceKm) || 0, fee: Number(draft.fee) || 0 }, creating); setDraft(null); }}>
        {draft ? (
          <>
            <TextField select label="Kind" value={draft.kind} onChange={(event) => patch({ kind: event.target.value as DeliveryKind })}>
              {kinds.map((kind) => <MenuItem key={kind} value={kind}>{titleCase(kind)}</MenuItem>)}
            </TextField>
            <TextField select label="City" value={draft.city} onChange={(event) => patch({ city: event.target.value as Delivery["city"] })}>
              <MenuItem value="abuja">Abuja</MenuItem>
              <MenuItem value="lagos">Lagos</MenuItem>
            </TextField>
            <TextField select label="Zone" value={draft.zoneId} onChange={(event) => patch({ zoneId: event.target.value })}>
              {zones.filter((zone) => zone.city === draft.city).map((zone) => <MenuItem key={zone.id} value={zone.id}>{zone.name}</MenuItem>)}
            </TextField>
            <TextField label="Pickup" value={draft.pickup} onChange={(event) => patch({ pickup: event.target.value })} />
            <TextField label="Dropoff" value={draft.dropoff} onChange={(event) => patch({ dropoff: event.target.value })} />
            <TextField label="Note" value={draft.note} onChange={(event) => patch({ note: event.target.value })} />
            <TextField select label="Customer" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
              {customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}
            </TextField>
            <TextField select label="Driver" value={draft.driverId ?? ""} onChange={(event) => patch({ driverId: event.target.value || null })}>
              <MenuItem value="">Unassigned</MenuItem>
              {drivers.filter((driver) => driver.city === draft.city).map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.name}</MenuItem>)}
            </TextField>
            <TextField label="Distance (km)" type="number" value={draft.distanceKm} onChange={(event) => patch({ distanceKm: Number(event.target.value) })} />
            <TextField label="Fee (₦)" type="number" value={draft.fee} onChange={(event) => patch({ fee: Number(event.target.value) })} />
            <TextField select label="Status" value={draft.status} onChange={(event) => patch({ status: event.target.value as DeliveryStatus })}>
              {statuses.map((status) => <MenuItem key={status} value={status}>{titleCase(status)}</MenuItem>)}
            </TextField>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this delivery?" body="The order leaves the desk." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeDelivery(removeId); setRemoveId(null); }} />
    </Box>
  );
}
