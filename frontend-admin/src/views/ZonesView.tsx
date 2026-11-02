"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { FleetMap } from "@/components/map/FleetMap";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { DeliveryKind, DeliveryZone, RideZone } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const services: DeliveryKind[] = ["courier", "freight", "food", "grocery"];

export function ZonesView() {
  const edit = useEdit();
  const rideZones = useAdminStore((state) => state.rideZones);
  const deliveryZones = useAdminStore((state) => state.deliveryZones);
  const saveRideZone = useAdminStore((state) => state.saveRideZone);
  const removeRideZone = useAdminStore((state) => state.removeRideZone);
  const saveDeliveryZone = useAdminStore((state) => state.saveDeliveryZone);
  const removeDeliveryZone = useAdminStore((state) => state.removeDeliveryZone);
  const [tab, setTab] = useState<"ride" | "delivery">("ride");
  const [rideDraft, setRideDraft] = useState<RideZone | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<DeliveryZone | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  return (
    <Box>
      <PageHeader
        kicker="Coverage"
        title="Zones"
        lede="Ride zones set the surge and the minimum fare. Delivery zones set the fee, the services, and how far an order can travel."
        action={edit ? <Button variant="contained" onClick={() => {
          setCreating(true);
          if (tab === "ride") setRideDraft({ id: uid("rz"), name: "", city: "abuja", active: true, surge: 1, minFare: 800, cx: 50, cy: 50, rx: 14, ry: 12 });
          else setDeliveryDraft({ id: uid("dz"), name: "", city: "lagos", active: true, fee: 1000, maxKm: 10, services: ["courier"], cx: 50, cy: 50, rx: 14, ry: 12 });
        }}>Add zone</Button> : null}
      />
      <Tabs value={tab} onChange={(_, value: "ride" | "delivery") => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="ride" label="Ride zones" />
        <Tab value="delivery" label="Delivery zones" />
      </Tabs>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: 2 }}>
        <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
          {tab === "ride" ? (
            <Table size="small">
              <TableHead><TableRow><TableCell>Zone</TableCell><TableCell>City</TableCell><TableCell>Surge</TableCell><TableCell>Minimum</TableCell><TableCell>State</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {rideZones.map((zone) => (
                  <TableRow key={zone.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{zone.name}</TableCell>
                    <TableCell>{cityLabel(zone.city)}</TableCell>
                    <TableCell>{zone.surge.toFixed(2)}×</TableCell>
                    <TableCell>{naira(zone.minFare)}</TableCell>
                    <TableCell><Pill tone={zone.active ? "ok" : "off"}>{zone.active ? "Live" : "Paused"}</Pill></TableCell>
                    <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                      <IconButton aria-label={`Edit ${zone.name}`} onClick={() => { setCreating(false); setRideDraft({ ...zone }); }}><EditOutlinedIcon /></IconButton>
                      <IconButton aria-label={`Delete ${zone.name}`} onClick={() => setRemoveId(zone.id)}><DeleteOutlinedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table size="small">
              <TableHead><TableRow><TableCell>Zone</TableCell><TableCell>City</TableCell><TableCell>Fee</TableCell><TableCell>Max distance</TableCell><TableCell>Services</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {deliveryZones.map((zone) => (
                  <TableRow key={zone.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{zone.name}</TableCell>
                    <TableCell>{cityLabel(zone.city)}</TableCell>
                    <TableCell>{naira(zone.fee)}</TableCell>
                    <TableCell>{zone.maxKm} km</TableCell>
                    <TableCell>{zone.services.map(titleCase).join(", ")}</TableCell>
                    <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                      <IconButton aria-label={`Edit ${zone.name}`} onClick={() => { setCreating(false); setDeliveryDraft({ ...zone, services: [...zone.services] }); }}><EditOutlinedIcon /></IconButton>
                      <IconButton aria-label={`Delete ${zone.name}`} onClick={() => setRemoveId(zone.id)}><DeleteOutlinedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
        <FleetMap
          selected={null}
          onSelect={() => undefined}
          markers={[]}
          regions={(tab === "ride" ? rideZones : deliveryZones).map((zone) => ({ ...zone, kind: tab }))}
        />
      </Box>

      <Editor open={Boolean(rideDraft)} title={creating ? "New ride zone" : "Edit ride zone"} onClose={() => setRideDraft(null)} onSave={() => { if (!rideDraft || !rideDraft.name.trim()) return; saveRideZone({ ...rideDraft, surge: Number(rideDraft.surge) || 1, minFare: Number(rideDraft.minFare) || 0 }, creating); setRideDraft(null); }}>
        {rideDraft ? <ZoneFields zone={rideDraft} onChange={setRideDraft} extra={
          <>
            <TextField label="Surge multiplier" type="number" value={rideDraft.surge} onChange={(event) => setRideDraft({ ...rideDraft, surge: Number(event.target.value) })} />
            <TextField label="Minimum fare (₦)" type="number" value={rideDraft.minFare} onChange={(event) => setRideDraft({ ...rideDraft, minFare: Number(event.target.value) })} />
          </>
        } /> : null}
      </Editor>
      <Editor open={Boolean(deliveryDraft)} title={creating ? "New delivery zone" : "Edit delivery zone"} onClose={() => setDeliveryDraft(null)} onSave={() => { if (!deliveryDraft || !deliveryDraft.name.trim()) return; saveDeliveryZone({ ...deliveryDraft, fee: Number(deliveryDraft.fee) || 0, maxKm: Number(deliveryDraft.maxKm) || 0 }, creating); setDeliveryDraft(null); }}>
        {deliveryDraft ? <ZoneFields zone={deliveryDraft} onChange={setDeliveryDraft} extra={
          <>
            <TextField label="Delivery fee (₦)" type="number" value={deliveryDraft.fee} onChange={(event) => setDeliveryDraft({ ...deliveryDraft, fee: Number(event.target.value) })} />
            <TextField label="Max distance (km)" type="number" value={deliveryDraft.maxKm} onChange={(event) => setDeliveryDraft({ ...deliveryDraft, maxKm: Number(event.target.value) })} />
            <TextField select label="Services" value={deliveryDraft.services} slotProps={{ select: { multiple: true } }} onChange={(event) => setDeliveryDraft({ ...deliveryDraft, services: event.target.value as unknown as DeliveryKind[] })}>
              {services.map((service) => <MenuItem key={service} value={service}>{titleCase(service)}</MenuItem>)}
            </TextField>
          </>
        } /> : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this zone?" body="Orders that pointed at it keep their record, without a live zone." onClose={() => setRemoveId(null)} onConfirm={() => {
        if (!removeId) return;
        if (tab === "ride") removeRideZone(removeId);
        else removeDeliveryZone(removeId);
        setRemoveId(null);
      }} />
    </Box>
  );
}

function ZoneFields<T extends RideZone | DeliveryZone>({ zone, onChange, extra }: { zone: T; onChange: (zone: T) => void; extra: React.ReactNode }) {
  return (
    <>
      <TextField label="Name" value={zone.name} onChange={(event) => onChange({ ...zone, name: event.target.value })} />
      <TextField select label="City" value={zone.city} onChange={(event) => onChange({ ...zone, city: event.target.value as T["city"] })}>
        <MenuItem value="abuja">Abuja</MenuItem>
        <MenuItem value="lagos">Lagos</MenuItem>
      </TextField>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <TextField label="Centre X" type="number" value={zone.cx} onChange={(event) => onChange({ ...zone, cx: Number(event.target.value) })} />
        <TextField label="Centre Y" type="number" value={zone.cy} onChange={(event) => onChange({ ...zone, cy: Number(event.target.value) })} />
        <TextField label="Width" type="number" value={zone.rx} onChange={(event) => onChange({ ...zone, rx: Number(event.target.value) })} />
        <TextField label="Height" type="number" value={zone.ry} onChange={(event) => onChange({ ...zone, ry: Number(event.target.value) })} />
      </Box>
      {extra}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ fontWeight: 700 }}>Live</Box>
        <Switch checked={zone.active} onChange={(event) => onChange({ ...zone, active: event.target.checked })} />
      </Box>
    </>
  );
}
