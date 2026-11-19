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
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { emptyDriverProfile, maskAccount, readyToGoLive, withProfile } from "@/lib/drivers";
import { bankNames, listed, relationships } from "@/lib/options";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Driver, DriverProfile } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

function blank(): Driver {
  return withProfile({ id: uid("d"), name: "", phone: "+234 ", email: "", city: "abuja", ninStatus: "pending", status: "pending", online: false, rating: 5, trips: 0, vehicle: "", plate: "", classId: "ryde", x: 40, y: 40, papers: "valid", earningsToday: 0, profile: emptyDriverProfile() });
}

function accountLabel(status: Driver["status"]) {
  return status === "active" ? "Approved" : titleCase(status);
}

function accountTone(status: Driver["status"]): "ok" | "warn" | "hot" | "off" {
  if (status === "active") return "ok";
  if (status === "pending") return "warn";
  if (status === "suspended") return "hot";
  return "off";
}

function liveNote(driver: Driver) {
  if (driver.status === "pending") return "Pending until approved. They cannot go live yet.";
  if (driver.status !== "active") return "This account cannot go live.";
  if (driver.ninStatus !== "verified" || driver.papers !== "valid") return "Approved, but a passed NIN check and valid papers are still required before they can go live.";
  return "Approved. They can go live.";
}

function Section({ children }: { children: string }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "text.secondary", mt: 1 }}>{children}</Typography>;
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
  const [approveId, setApproveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter((driver) => !q || `${driver.name} ${driver.plate} ${driver.city} ${driver.vehicle} ${driver.profile?.address ?? ""} ${driver.profile?.licenceNumber ?? ""}`.toLowerCase().includes(q));
  }, [drivers, query]);

  const patch = (partial: Partial<Driver>) =>
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      return { ...next, online: readyToGoLive(next) ? next.online : false };
    });
  const patchProfile = (partial: Partial<DriverProfile>) =>
    setDraft((current) => (current ? { ...current, profile: { ...emptyDriverProfile(), ...current.profile, ...partial } } : current));

  return (
    <Box>
      <PageHeader
        kicker="People"
        title="Drivers"
        lede="After signup a driver stays pending until you approve them. They cannot go live before that, and a passed NIN check with valid papers is still required."
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
                  <Box sx={{ color: "text.secondary", fontSize: 13 }}>{driver.vehicle} · {driver.plate}{driver.profile?.address ? ` · ${driver.profile.address}` : ""}</Box>
                </TableCell>
                <TableCell>{cityLabel(driver.city)}</TableCell>
                <TableCell>{classes.find((item) => item.id === driver.classId)?.label ?? driver.classId}</TableCell>
                <TableCell><Pill tone={driver.ninStatus === "verified" ? "ok" : driver.ninStatus === "failed" ? "hot" : "warn"}>{driver.ninStatus}</Pill></TableCell>
                <TableCell><Pill tone={driver.papers === "valid" ? "ok" : driver.papers === "expired" ? "hot" : "warn"}>{driver.papers}</Pill></TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                    <Pill tone={accountTone(driver.status)}>{accountLabel(driver.status)}</Pill>
                    <Pill tone={driver.online ? "ok" : "off"}>{driver.online ? "Live" : "Not live"}</Pill>
                  </Box>
                </TableCell>
                <TableCell>{driver.x.toFixed(0)}, {driver.y.toFixed(0)}</TableCell>
                <TableCell>{naira(driver.earningsToday)}</TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  {driver.status === "pending" ? (
                    <Button size="small" onClick={() => setApproveId(driver.id)}>Approve</Button>
                  ) : null}
                  <IconButton aria-label={`Edit ${driver.name}`} onClick={() => { setCreating(false); setDraft(withProfile(driver)); }}><EditOutlinedIcon /></IconButton>
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
          const profile = { ...emptyDriverProfile(), ...draft.profile, maskedAccount: maskAccount(draft.profile?.maskedAccount ?? "") };
          const next = { ...draft, name: draft.name.trim(), profile };
          saveDriver({ ...next, online: readyToGoLive(next) && next.online }, creating);
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
            <Section>PERSONAL DETAILS</Section>
            <TextField label="Middle name" value={draft.profile?.middleName ?? ""} onChange={(event) => patchProfile({ middleName: event.target.value })} />
            <TextField label="Date of birth" type="date" value={draft.profile?.dob ?? ""} onChange={(event) => patchProfile({ dob: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select label="Gender" value={draft.profile?.gender ?? ""} onChange={(event) => patchProfile({ gender: event.target.value as DriverProfile["gender"] })}>
              <MenuItem value="">Not set</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
            </TextField>
            <TextField label="Residential address" value={draft.profile?.address ?? ""} onChange={(event) => patchProfile({ address: event.target.value })} />
            <TextField label="State" value={draft.profile?.state ?? ""} onChange={(event) => patchProfile({ state: event.target.value })} />
            <TextField label="LGA" value={draft.profile?.lga ?? ""} onChange={(event) => patchProfile({ lga: event.target.value })} />
            <Section>LICENCE AND VEHICLE</Section>
            <TextField label="Licence number" value={draft.profile?.licenceNumber ?? ""} onChange={(event) => patchProfile({ licenceNumber: event.target.value })} />
            <TextField label="Licence expiry" type="date" value={draft.profile?.licenceExpiry ?? ""} onChange={(event) => patchProfile({ licenceExpiry: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Colour" value={draft.profile?.colour ?? ""} onChange={(event) => patchProfile({ colour: event.target.value })} />
            <TextField label="Year" value={draft.profile?.year ?? ""} onChange={(event) => patchProfile({ year: event.target.value.replace(/\D/g, "").slice(0, 4) })} />
            <TextField select label="Category" value={draft.profile?.category || "Sedan"} onChange={(event) => patchProfile({ category: event.target.value })}>
              {["Sedan", "SUV", "Hatchback", "Premium"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </TextField>
            <TextField select label="Inspection" value={draft.profile?.inspection ?? "not_scheduled"} onChange={(event) => patchProfile({ inspection: event.target.value as DriverProfile["inspection"] })}>
              <MenuItem value="not_scheduled">Not scheduled</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="in_progress">In progress</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="resubmit">Resubmit</MenuItem>
            </TextField>
            <Section>PAYOUT AND EMERGENCY</Section>
            <TextField select label="Bank" value={draft.profile?.bankName ?? ""} onChange={(event) => patchProfile({ bankName: event.target.value })}>
              <MenuItem value="">Not set</MenuItem>
              {listed(draft.profile?.bankName ?? "", bankNames).map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <TextField label="Account, last 4" value={draft.profile?.maskedAccount ?? ""} onChange={(event) => patchProfile({ maskedAccount: event.target.value })} helperText="Only the last four digits are kept." />
            <TextField select label="Bank check" value={draft.profile?.bankStatus ?? "missing"} onChange={(event) => patchProfile({ bankStatus: event.target.value as DriverProfile["bankStatus"] })}>
              <MenuItem value="missing">Missing</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField label="Emergency name" value={draft.profile?.emergencyName ?? ""} onChange={(event) => patchProfile({ emergencyName: event.target.value })} />
            <TextField select label="Relationship" value={draft.profile?.emergencyRelationship ?? ""} onChange={(event) => patchProfile({ emergencyRelationship: event.target.value })}>
              <MenuItem value="">Not set</MenuItem>
              {listed(draft.profile?.emergencyRelationship ?? "", relationships).map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <TextField label="Emergency phone" value={draft.profile?.emergencyPhone ?? ""} onChange={(event) => patchProfile({ emergencyPhone: event.target.value })} />
            <Section>DESK</Section>
            <TextField select label="NIN check" value={draft.ninStatus} onChange={(event) => patch({ ninStatus: event.target.value as Driver["ninStatus"] })} helperText="The NIN itself is not stored.">
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField select label="Account" value={draft.status} onChange={(event) => patch({ status: event.target.value as Driver["status"] })} helperText="Signup leaves this pending. Approve it before the driver can go live.">
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="active">Approved</MenuItem>
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
                <Box sx={{ fontWeight: 700 }}>Go live</Box>
                <Box sx={{ color: "text.secondary", fontSize: 13 }}>{liveNote(draft)}</Box>
              </Box>
              <Switch checked={readyToGoLive(draft) && draft.online} disabled={!readyToGoLive(draft)} onChange={(event) => patch({ online: event.target.checked })} />
            </Box>
          </>
        ) : null}
      </Editor>
      <Confirm open={Boolean(removeId)} title="Remove this driver?" body="The roster and any subscription on this driver are removed from the console." onClose={() => setRemoveId(null)} onConfirm={() => { if (removeId) removeDriver(removeId); setRemoveId(null); }} />
      <Confirm
        open={Boolean(approveId)}
        title="Approve this driver?"
        body="They leave pending. They are not put on the map. Going live still waits for a passed NIN check and valid papers."
        confirmLabel="Approve"
        confirmColor="primary"
        onClose={() => setApproveId(null)}
        onConfirm={() => {
          const driver = drivers.find((item) => item.id === approveId);
          if (driver) saveDriver({ ...withProfile(driver), status: "active", online: false }, false);
          setApproveId(null);
        }}
      />
    </Box>
  );
}
