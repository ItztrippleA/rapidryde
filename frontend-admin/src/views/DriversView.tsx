"use client";

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverActivity } from "@/components/drivers/DriverActivity";
import { Confirm, Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { useEdit } from "@/components/access/Gate";
import { adminLogin, api, hasApi } from "@/lib/api";
import { emptyDriverProfile, maskAccount, readyToGoLive, withProfile } from "@/lib/drivers";
import { bankNames, listed, relationships } from "@/lib/options";
import { cityLabel, naira, titleCase, uid } from "@/lib/format";
import type { Driver, DriverProfile } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";
import { labelOf, RideDetailDialog, type SessionRow, whenOf } from "@/views/RidesView";

type AppRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  email: string;
  city: string;
  accountStatus: string;
  applicationStatus: string;
  ninStatus: string;
  papers: string;
  submittedAt: number | null;
  updatedAt: number;
  profile: {
    firstName: string;
    middleName: string;
    lastName: string;
    dob: string;
    gender: string;
    address: string;
    state: string;
    lga: string;
    photoUrl: string;
  };
  identity: {
    maskedNin: string | null;
    status: string;
    matchConfidence: number | null;
    failureReason: string | null;
    provider: string | null;
    slipAttached: boolean;
    consented: boolean;
    verifiedAt: number | null;
  };
  licence: {
    number: string;
    expiry: string;
    status: string;
    failureReason: string;
    frontUri: string;
    backUri: string;
  };
  vehicle: {
    make: string;
    model: string;
    plate: string;
    colour: string;
    year: string;
    category: string;
    fuelType: string;
    classId: string;
    insuranceExpiry: string;
    status: string;
  };
  inspection: { status: string; scheduledAt: number | null; note: string };
  bank: { bankName: string; maskedAccount: string; status: string };
  emergency: { name: string; relationship: string; phone: string };
};

function blank(): Driver {
  return withProfile({
    id: uid("d"),
    name: "",
    phone: "+234 ",
    email: "",
    city: "abuja",
    ninStatus: "pending",
    status: "pending",
    online: false,
    rating: 5,
    trips: 0,
    vehicle: "",
    plate: "",
    classId: "ryde",
    x: 40,
    y: 40,
    papers: "valid",
    earningsToday: 0,
    profile: emptyDriverProfile(),
  });
}

function accountLabel(status: Driver["status"]) {
  return status === "active" ? "Approved" : titleCase(status);
}

function accountTone(status: string): "ok" | "warn" | "hot" | "off" {
  if (status === "active" || status === "approved") return "ok";
  if (status === "pending" || status === "under_review" || status === "draft") return "warn";
  if (status === "suspended" || status === "rejected") return "hot";
  return "off";
}

function liveNote(driver: Driver) {
  if (driver.status === "pending") return "Pending until approved. They cannot go live yet.";
  if (driver.status !== "active") return "This account cannot go live.";
  if (driver.ninStatus !== "verified" || driver.papers !== "valid") {
    return "Approved, but a passed NIN check and valid papers are still required before they can go live.";
  }
  return "Approved. They can go live.";
}

function Section({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "text.secondary", mt: 1 }}>
      {children}
    </Typography>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | number | null }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.6, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{text}</Typography>
    </Box>
  );
}

function when(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function DriversView() {
  const edit = useEdit();
  const seedDrivers = useAdminStore((state) => state.drivers);
  const classes = useAdminStore((state) => state.pricing.classes);
  const saveDriver = useAdminStore((state) => state.saveDriver);
  const removeDriver = useAdminStore((state) => state.removeDriver);
  const live = hasApi();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AppRow | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [driverRides, setDriverRides] = useState<SessionRow[]>([]);
  const [ridesLoading, setRidesLoading] = useState(false);
  const [rideDetail, setRideDetail] = useState<SessionRow | null>(null);

  const [draft, setDraft] = useState<Driver | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);

  const openDriver = useCallback(async (row: AppRow) => {
    setSelected(row);
    setDriverRides([]);
    setRideDetail(null);
    if (!live) return;
    setRidesLoading(true);
    try {
      const { token } = await adminLogin();
      const rides = await api<SessionRow[]>(`/rides?driverId=${encodeURIComponent(row.id)}&limit=50`, { token });
      setDriverRides(rides);
    } catch {
      setDriverRides([]);
    } finally {
      setRidesLoading(false);
    }
  }, [live]);

  const load = useCallback(async () => {
    if (!live) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const params = new URLSearchParams({ limit: "300" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const remote = await api<AppRow[]>(`/admin/drivers/applications?${params}`, { token });
      setRows(remote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load driver applications.");
    } finally {
      setLoading(false);
    }
  }, [live, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.phone} ${row.email} ${row.code || ""} ${row.vehicle.plate} ${row.vehicle.model} ${row.profile.address} ${row.licence.number}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const seedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seedDrivers.filter(
      (driver) =>
        !q ||
        `${driver.name} ${driver.plate} ${driver.city} ${driver.vehicle} ${driver.profile?.address ?? ""} ${driver.profile?.licenceNumber ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [seedDrivers, query]);

  const patch = (partial: Partial<Driver>) =>
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      return { ...next, online: readyToGoLive(next) ? next.online : false };
    });
  const patchProfile = (partial: Partial<DriverProfile>) =>
    setDraft((current) =>
      current ? { ...current, profile: { ...emptyDriverProfile(), ...current.profile, ...partial } } : current,
    );

  async function decide(decision: "approve" | "reject") {
    if (!selected || !edit) return;
    setDeciding(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const next = await api<AppRow>(`/admin/drivers/${selected.id}/decide`, {
        method: "POST",
        token,
        body: JSON.stringify({ decision }),
      });
      setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
      setSelected(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update application.");
    } finally {
      setDeciding(false);
    }
  }

  if (live) {
    return (
      <Box>
        <PageHeader
          kicker="People"
          title="Drivers"
          lede="Review every submitted application: identity, licence, vehicle, bank, and emergency contact. Approve only when the file is complete."
          action={
            <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          }
        />
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
          <TextField
            size="small"
            label="Search drivers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ width: { xs: "100%", sm: 320 } }}
          />
          <TextField
            select
            size="small"
            label="Application"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="under_review">Under review</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </TextField>
        </Box>
        {error ? (
          <Typography color="error" sx={{ mb: 1.5, fontSize: 13 }}>
            {error}
          </Typography>
        ) : null}
        <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Driver</TableCell>
                <TableCell>City</TableCell>
                <TableCell>NIN</TableCell>
                <TableCell>Licence</TableCell>
                <TableCell>Vehicle</TableCell>
                <TableCell>Application</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9}>Loading applications…</TableCell>
                </TableRow>
              ) : filteredLive.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>No driver applications yet.</TableCell>
                </TableRow>
              ) : (
                filteredLive.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    selected={selected?.id === row.id}
                    onClick={() => void openDriver(row)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Box sx={{ fontWeight: 700 }}>{row.name}</Box>
                      <Box sx={{ color: "text.secondary", fontSize: 13 }}>
                        {row.code || row.id} · {row.phone}
                        {row.email ? ` · ${row.email}` : ""}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.city === "abuja" || row.city === "lagos"
                        ? cityLabel(row.city)
                        : titleCase(row.city || "—")}
                    </TableCell>
                    <TableCell>
                      <Pill tone={row.ninStatus === "verified" ? "ok" : row.ninStatus === "failed" ? "hot" : "warn"}>
                        {row.identity.status || row.ninStatus}
                      </Pill>
                      {row.identity.maskedNin ? (
                        <Box sx={{ color: "text.secondary", fontSize: 12, mt: 0.4 }}>{row.identity.maskedNin}</Box>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Pill tone={row.licence.status === "approved" ? "ok" : row.licence.status === "rejected" ? "hot" : "warn"}>
                        {row.licence.status || "missing"}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ fontWeight: 600 }}>
                        {[row.vehicle.make, row.vehicle.model].filter(Boolean).join(" ") || "—"}
                      </Box>
                      <Box sx={{ color: "text.secondary", fontSize: 13 }}>{row.vehicle.plate || "No plate"}</Box>
                    </TableCell>
                    <TableCell>
                      <Pill tone={accountTone(row.applicationStatus)}>{titleCase(row.applicationStatus)}</Pill>
                    </TableCell>
                    <TableCell>
                      <Pill tone={accountTone(row.accountStatus)}>{titleCase(row.accountStatus)}</Pill>
                    </TableCell>
                    <TableCell>{when(row.submittedAt)}</TableCell>
                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                      <Button size="small" onClick={() => void openDriver(row)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        <Editor
          open={Boolean(selected)}
          title={selected ? `Review · ${selected.name}` : "Review"}
          saveLabel={
            selected?.applicationStatus === "approved"
              ? "Close"
              : edit
                ? "Approve driver"
                : "Close"
          }
          onClose={() => {
            setSelected(null);
            setDriverRides([]);
            setRideDetail(null);
          }}
          onSave={() => {
            if (!selected) return;
            if (!edit || selected.applicationStatus === "approved") {
              setSelected(null);
              setDriverRides([]);
              return;
            }
            void decide("approve");
          }}
        >
          {selected ? (
            <>
              <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                <Pill tone={accountTone(selected.applicationStatus)}>{titleCase(selected.applicationStatus)}</Pill>
                <Pill tone={accountTone(selected.accountStatus)}>{titleCase(selected.accountStatus)}</Pill>
                <Pill tone={selected.ninStatus === "verified" ? "ok" : selected.ninStatus === "failed" ? "hot" : "warn"}>
                  NIN {selected.identity.status || selected.ninStatus}
                </Pill>
              </Box>
              <Section>PERSONAL</Section>
              <DetailLine label="Code" value={selected.code} />
              <DetailLine label="Name" value={selected.name} />
              <DetailLine label="Phone" value={selected.phone} />
              <DetailLine label="Email" value={selected.email} />
              <DetailLine label="DOB" value={selected.profile.dob} />
              <DetailLine label="Gender" value={selected.profile.gender} />
              <DetailLine label="Address" value={selected.profile.address} />
              <DetailLine label="State / LGA" value={[selected.profile.state, selected.profile.lga].filter(Boolean).join(" · ")} />
              <DetailLine label="City" value={selected.city} />

              <Section>IDENTITY</Section>
              <DetailLine label="Status" value={selected.identity.status} />
              <DetailLine label="Masked NIN" value={selected.identity.maskedNin} />
              <DetailLine
                label="Face match"
                value={
                  typeof selected.identity.matchConfidence === "number"
                    ? `${Math.round(selected.identity.matchConfidence)}%`
                    : null
                }
              />
              <DetailLine label="Provider" value={selected.identity.provider} />
              <DetailLine label="Slip attached" value={selected.identity.slipAttached ? "Yes" : "No"} />
              <DetailLine label="Consented" value={selected.identity.consented ? "Yes" : "No"} />
              <DetailLine label="Failure" value={selected.identity.failureReason} />
              <DetailLine label="Verified at" value={when(selected.identity.verifiedAt)} />

              <Section>LICENCE</Section>
              <DetailLine label="Status" value={selected.licence.status} />
              <DetailLine label="Number" value={selected.licence.number} />
              <DetailLine label="Expiry" value={selected.licence.expiry} />
              <DetailLine label="Failure" value={selected.licence.failureReason} />

              <Section>VEHICLE</Section>
              <DetailLine label="Status" value={selected.vehicle.status} />
              <DetailLine label="Make / model" value={[selected.vehicle.make, selected.vehicle.model].filter(Boolean).join(" ")} />
              <DetailLine label="Plate" value={selected.vehicle.plate} />
              <DetailLine label="Colour / year" value={[selected.vehicle.colour, selected.vehicle.year].filter(Boolean).join(" · ")} />
              <DetailLine label="Category" value={selected.vehicle.category} />
              <DetailLine label="Power" value={selected.vehicle.fuelType} />
              <DetailLine label="Class" value={selected.vehicle.classId} />
              <DetailLine label="Insurance expiry" value={selected.vehicle.insuranceExpiry} />

              <Section>INSPECTION</Section>
              <DetailLine label="Status" value={selected.inspection.status} />
              <DetailLine label="Scheduled" value={when(selected.inspection.scheduledAt)} />
              <DetailLine label="Note" value={selected.inspection.note} />

              <Section>BANK</Section>
              <DetailLine label="Status" value={selected.bank.status} />
              <DetailLine label="Bank" value={selected.bank.bankName} />
              <DetailLine label="Account (last 4)" value={selected.bank.maskedAccount} />

              <Section>EMERGENCY</Section>
              <DetailLine label="Name" value={selected.emergency.name} />
              <DetailLine label="Relationship" value={selected.emergency.relationship} />
              <DetailLine label="Phone" value={selected.emergency.phone} />

              <Section>TIMELINE</Section>
              <DetailLine label="Submitted" value={when(selected.submittedAt)} />
              <DetailLine label="Updated" value={when(selected.updatedAt)} />

              <Section>RIDE HISTORY</Section>
              {ridesLoading ? (
                <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                  Loading rides…
                </Typography>
              ) : driverRides.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                  No rides for this driver yet.
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gap: 0.8 }}>
                  {driverRides.map((ride) => (
                    <Box
                      key={ride.id}
                      onClick={() => setRideDetail(ride)}
                      sx={{
                        p: 1.2,
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: "divider",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          {labelOf(ride.pickup)} → {labelOf(ride.dropoff)}
                        </Typography>
                        <Pill tone={ride.status === "cancelled" ? "hot" : ride.status === "completed" ? "off" : "ok"}>
                          {titleCase(ride.status)}
                        </Pill>
                      </Box>
                      <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.4 }}>
                        {whenOf(ride)} · {naira(ride.fare)}
                        {ride.customer?.name ? ` · ${ride.customer.name}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {edit && selected.applicationStatus !== "approved" ? (
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={deciding}
                    onClick={() => void decide("reject")}
                    fullWidth
                  >
                    Reject
                  </Button>
                  <Button variant="contained" disabled={deciding} onClick={() => void decide("approve")} fullWidth>
                    {deciding ? "Saving…" : "Approve"}
                  </Button>
                </Box>
              ) : null}
            </>
          ) : null}
        </Editor>
        <RideDetailDialog
          ride={rideDetail}
          onClose={() => setRideDetail(null)}
          onUpdated={(next) => {
            setDriverRides((rows) => rows.map((row) => (row.id === next.id ? { ...row, ...next } : row)));
            setRideDetail(null);
          }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        kicker="People"
        title="Drivers"
        lede="After signup a driver stays pending until you approve them. They cannot go live before that, and a passed NIN check with valid papers is still required."
        action={
          edit ? (
            <Button
              variant="contained"
              onClick={() => {
                setCreating(true);
                setDraft(blank());
              }}
            >
              Add driver
            </Button>
          ) : null
        }
      />
      <DriverActivity />
      <TextField
        size="small"
        label="Search drivers"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ mb: 2, width: { xs: "100%", sm: 320 } }}
      />
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
            {seedRows.map((driver) => (
              <TableRow key={driver.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 700 }}>{driver.name}</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 13 }}>
                    {driver.vehicle} · {driver.plate}
                    {driver.profile?.address ? ` · ${driver.profile.address}` : ""}
                  </Box>
                </TableCell>
                <TableCell>{cityLabel(driver.city)}</TableCell>
                <TableCell>{classes.find((item) => item.id === driver.classId)?.label ?? driver.classId}</TableCell>
                <TableCell>
                  <Pill tone={driver.ninStatus === "verified" ? "ok" : driver.ninStatus === "failed" ? "hot" : "warn"}>
                    {driver.ninStatus}
                  </Pill>
                </TableCell>
                <TableCell>
                  <Pill tone={driver.papers === "valid" ? "ok" : driver.papers === "expired" ? "hot" : "warn"}>
                    {driver.papers}
                  </Pill>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
                    <Pill tone={accountTone(driver.status)}>{accountLabel(driver.status)}</Pill>
                    <Pill tone={driver.online ? "ok" : "off"}>{driver.online ? "Live" : "Not live"}</Pill>
                  </Box>
                </TableCell>
                <TableCell>
                  {driver.x.toFixed(0)}, {driver.y.toFixed(0)}
                </TableCell>
                <TableCell>{naira(driver.earningsToday)}</TableCell>
                <TableCell align="right" sx={{ display: edit ? "table-cell" : "none" }}>
                  {driver.status === "pending" ? (
                    <Button size="small" onClick={() => setApproveId(driver.id)}>
                      Approve
                    </Button>
                  ) : null}
                  <IconButton
                    aria-label={`Edit ${driver.name}`}
                    onClick={() => {
                      setCreating(false);
                      setDraft(withProfile(driver));
                    }}
                  >
                    <EditOutlinedIcon />
                  </IconButton>
                  <IconButton aria-label={`Delete ${driver.name}`} onClick={() => setRemoveId(driver.id)}>
                    <DeleteOutlinedIcon />
                  </IconButton>
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
          const profile = {
            ...emptyDriverProfile(),
            ...draft.profile,
            maskedAccount: maskAccount(draft.profile?.maskedAccount ?? ""),
          };
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
              {classes.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Vehicle" value={draft.vehicle} onChange={(event) => patch({ vehicle: event.target.value })} />
            <TextField label="Plate" value={draft.plate} onChange={(event) => patch({ plate: event.target.value })} />
            <Section>PERSONAL DETAILS</Section>
            <TextField label="Middle name" value={draft.profile?.middleName ?? ""} onChange={(event) => patchProfile({ middleName: event.target.value })} />
            <TextField
              label="Date of birth"
              type="date"
              value={draft.profile?.dob ?? ""}
              onChange={(event) => patchProfile({ dob: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Gender"
              value={draft.profile?.gender ?? ""}
              onChange={(event) => patchProfile({ gender: event.target.value as DriverProfile["gender"] })}
            >
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
            <TextField
              label="Licence expiry"
              type="date"
              value={draft.profile?.licenceExpiry ?? ""}
              onChange={(event) => patchProfile({ licenceExpiry: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="Colour" value={draft.profile?.colour ?? ""} onChange={(event) => patchProfile({ colour: event.target.value })} />
            <TextField
              label="Year"
              value={draft.profile?.year ?? ""}
              onChange={(event) => patchProfile({ year: event.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
            <TextField select label="Category" value={draft.profile?.category || "Sedan"} onChange={(event) => patchProfile({ category: event.target.value })}>
              {["Sedan", "SUV", "Hatchback", "Premium"].map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Power" value={draft.profile?.fuelType || ""} onChange={(event) => patchProfile({ fuelType: event.target.value })}>
              <MenuItem value="">Not set</MenuItem>
              <MenuItem value="CNG">CNG</MenuItem>
              <MenuItem value="Fuel">Fuel</MenuItem>
            </TextField>
            <TextField
              select
              label="Inspection"
              value={draft.profile?.inspection ?? "not_scheduled"}
              onChange={(event) => patchProfile({ inspection: event.target.value as DriverProfile["inspection"] })}
            >
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
              {listed(draft.profile?.bankName ?? "", bankNames).map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Account, last 4"
              value={draft.profile?.maskedAccount ?? ""}
              onChange={(event) => patchProfile({ maskedAccount: event.target.value })}
              helperText="Only the last four digits are kept."
            />
            <TextField
              select
              label="Bank check"
              value={draft.profile?.bankStatus ?? "missing"}
              onChange={(event) => patchProfile({ bankStatus: event.target.value as DriverProfile["bankStatus"] })}
            >
              <MenuItem value="missing">Missing</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField label="Emergency name" value={draft.profile?.emergencyName ?? ""} onChange={(event) => patchProfile({ emergencyName: event.target.value })} />
            <TextField
              select
              label="Relationship"
              value={draft.profile?.emergencyRelationship ?? ""}
              onChange={(event) => patchProfile({ emergencyRelationship: event.target.value })}
            >
              <MenuItem value="">Not set</MenuItem>
              {listed(draft.profile?.emergencyRelationship ?? "", relationships).map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Emergency phone" value={draft.profile?.emergencyPhone ?? ""} onChange={(event) => patchProfile({ emergencyPhone: event.target.value })} />
            <Section>DESK</Section>
            <TextField
              select
              label="NIN check"
              value={draft.ninStatus}
              onChange={(event) => patch({ ninStatus: event.target.value as Driver["ninStatus"] })}
              helperText="The NIN itself is not stored."
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
            <TextField
              select
              label="Account"
              value={draft.status}
              onChange={(event) => patch({ status: event.target.value as Driver["status"] })}
              helperText="Signup leaves this pending. Approve it before the driver can go live."
            >
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
              <Switch
                checked={readyToGoLive(draft) && draft.online}
                disabled={!readyToGoLive(draft)}
                onChange={(event) => patch({ online: event.target.checked })}
              />
            </Box>
          </>
        ) : null}
      </Editor>
      <Confirm
        open={Boolean(removeId)}
        title="Remove this driver?"
        body="The roster and any subscription on this driver are removed from the console."
        onClose={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId) removeDriver(removeId);
          setRemoveId(null);
        }}
      />
      <Confirm
        open={Boolean(approveId)}
        title="Approve this driver?"
        body="They leave pending. They are not put on the map. Going live still waits for a passed NIN check and valid papers."
        confirmLabel="Approve"
        confirmColor="primary"
        onClose={() => setApproveId(null)}
        onConfirm={() => {
          const driver = seedDrivers.find((item) => item.id === approveId);
          if (driver) saveDriver({ ...withProfile(driver), status: "active", online: false }, false);
          setApproveId(null);
        }}
      />
    </Box>
  );
}
