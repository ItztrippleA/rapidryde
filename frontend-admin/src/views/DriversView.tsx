"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { useMemo, useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Driver } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

function blank(): Driver {
  return { id: uid("d"), name: "", phone: "+234 ", email: "", city: "abuja", ninStatus: "pending", status: "pending", online: false, rating: 5, trips: 0, vehicle: "", plate: "", classId: "ryde", x: 40, y: 40, papers: "valid", earningsToday: 0 };
}

export function DriversView() {
  const edit = useEdit();
  const drivers = useAdminStore((state) => state.drivers);
  const classes = useAdminStore((state) => state.pricing.classes);
  const saveDriver = useAdminStore((state) => state.saveDriver);
  const removeDriver = useAdminStore((state) => state.removeDriver);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Driver | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter((driver) => !q || `${driver.name} ${driver.plate} ${driver.city} ${driver.vehicle}`.toLowerCase().includes(q));
  }, [drivers, query]);

  const patch = (partial: Partial<Driver>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  return (
    <Box>
      <PageHeader
        kicker="People"
        title="Drivers"
        lede="Create, edit, or remove a driver. Going online still waits for a passed NIN check and valid papers."
        action={edit ? <Button variant="contained" onClick={() => { setCreating(true); setDraft(blank()); }}>Add driver</Button> : null}
      />
      <TextField size="small" label="Search drivers" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ mb: 2, width: { xs: "100%", sm: 320 } }} />
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Driver</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>NIN</TableCell>
              <TableCell>Papers</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Today</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((driver) => (
              <TableRow key={driver.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 700 }}>{driver.name}</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 13 }}>{driver.vehicle} · {driver.plate}</Box>
                </TableCell>
                <TableCell>{cityLabel(driver.city)}</TableCell>
                <TableCell>{classes.find((item) => item.id === driver.classId)?.label ?? driver.classId}</TableCell>
                <TableCell><Pill tone={driver.ninStatus === "verified" ? "ok" : driver.ninStatus === "failed" ? "hot" : "warn"}>{driver.ninStatus}</Pill></TableCell>
                <TableCell><Pill tone={driver.papers === "valid" ? "ok" : driver.papers === "expired" ? "hot" : "warn"}>{driver.papers}</Pill></TableCell>
                <TableCell><Pill tone={driver.online ? "ok" : "off"}>{driver.online ? "Online" : titleCase(driver.status)}</Pill></TableCell>
                <TableCell>{driver.x.toFixed(0)}, {driver.y.toFixed(0)}</TableCell>
                <TableCell>{naira(driver.earningsToday)}</TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  <IconButton aria-label={`Edit ${driver.name}`} onClick={() => { setCreating(false); setDraft({ ...driver }); }}><EditOutlinedIcon /></IconButton>
                  <IconButton aria-label={`Delete ${driver.name}`} onClick={() => setRemoveId(driver.id)}><DeleteOutlinedIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Editor
        open={Boolean(draft)}
        title={creating ? "New driver" : "Edit driver"}
        onClose={() => setDraft(null)}
        onSave={() => {
          if (!draft || !draft.name.trim() || draft.phone.trim().length < 6) return;
          const online = draft.ninStatus === "verified" && draft.papers === "valid" && draft.status === "active" ? draft.online : false;
          saveDriver({ ...draft, name: draft.name.trim(), online }, creating);
          setDraft(null);
        }}
      >
        {draft ? (
          <>
            <TextField label="Name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} required />
            <TextField label="Phone" value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} required />
            <TextField label="Email" value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
            <TextField select label="City" value={draft.city} onChange={(event) => patch({ city: event.target.value as Driver["city"] })}>
              <MenuItem value="abuja">Abuja</MenuItem>
              <MenuItem value="lagos">Lagos</MenuItem>
            </TextField>
            <TextField select label="Class" value={draft.classId} onChange={(event) => patch({ classId: event.target.value as Driver["classId"] })}>
              {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
            </TextField>
            <TextField label="Vehicle" value={draft.vehicle} onChange={(event) => patch({ vehicle: event.target.value })} />
            <TextField label="Plate" value={draft.plate} onChange={(event) => patch({ plate: event.target.value })} />
            <TextField select label="NIN check" value={draft.ninStatus} onChange={(event) => patch({ ninStatus: event.target.value as Driver["ninStatus"] })}>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField select label="Account" value={draft.status} onChange={(event) => patch({ status: event.target.value as Driver["status"] })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </TextField>
            <TextField select label="Papers" value={draft.papers} onChange={(event) => patch({ papers: event.target.value as Driver["papers"] })}>
              <MenuItem value="valid">Valid</MenuItem>
              <MenuItem value="expiring">Expiring</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </TextField>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField label="Map X" type="number" value={draft.x} onChange={(event) => patch({ x: Number(event.target.value) })} />
              <TextField label="Map Y" type="number" value={draft.y} onChange={(event) => patch({ y: Number(event.target.value) })} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Box sx={{ fontWeight: 700 }}>Online</Box>
                <Box sx={{ color: "text.secondary", fontSize: 13 }}>Only a verified driver with valid papers can stay online.</Box>
              </Box>
              <Switch checked={draft.online} onChange={(event) => patch({ online: event.target.checked })} />
            </Box>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this driver?" body="The roster and any subscription on this driver are removed from the console." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeDriver(removeId); setRemoveId(null); }} />
    </Box>
  );
}
