"use client";

import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEdit } from "@/components/access/Gate";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { ago, titleCase } from "@/lib/format";

type WaitlistRole = "rider" | "driver";
type WaitlistStatus = "new" | "contacted" | "invited" | "archived";

type WaitlistEntry = {
  id: string;
  role: WaitlistRole;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  city: string;
  vehicleType: string | null;
  interest: string | null;
  note: string | null;
  source: string;
  status: WaitlistStatus | string;
  createdAt: number;
};

const statuses: Array<WaitlistStatus | "all"> = ["all", "new", "contacted", "invited", "archived"];
const roles: Array<WaitlistRole | "all"> = ["all", "rider", "driver"];

function statusTone(status: string): "ok" | "warn" | "hot" | "off" {
  if (status === "new") return "hot";
  if (status === "contacted") return "warn";
  if (status === "invited") return "ok";
  return "off";
}

function roleLabel(role: WaitlistRole) {
  return role === "driver" ? "Driver" : "Passenger";
}

export function SurveyView() {
  const edit = useEdit();
  const [rows, setRows] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<WaitlistRole | "all">("all");
  const [status, setStatus] = useState<WaitlistStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setError("API URL is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const params = new URLSearchParams({ limit: "300" });
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);
      const remote = await api<WaitlistEntry[]>(`/admin/waitlist?${params}`, { token });
      setRows(remote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load waitlist.");
    } finally {
      setLoading(false);
    }
  }, [role, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.firstName} ${row.lastName} ${row.phone} ${row.email || ""} ${row.city} ${row.source}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const counts = useMemo(() => {
    const next = { total: rows.length, rider: 0, driver: 0, fresh: 0 };
    for (const row of rows) {
      if (row.role === "rider") next.rider += 1;
      if (row.role === "driver") next.driver += 1;
      if (row.status === "new") next.fresh += 1;
    }
    return next;
  }, [rows]);

  async function setEntryStatus(id: string, next: WaitlistStatus) {
    if (!edit) return;
    setSavingId(id);
    setError("");
    try {
      const { token } = await adminLogin();
      const updated = await api<WaitlistEntry>(`/admin/waitlist/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: next }),
      });
      setRows((current) => current.map((row) => (row.id === id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Box>
      <PageHeader
        kicker="People"
        title="Survey"
        lede="Landing waitlist for passengers and drivers. Contact them on WhatsApp, then mark the status so the team can see who has been invited."
        action={
          <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 2 }}>
        {[
          ["Signups", String(counts.total)],
          ["Passengers", String(counts.rider)],
          ["Drivers", String(counts.driver)],
          ["New", String(counts.fresh)],
        ].map(([label, value]) => (
          <Box key={label} sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
              {label}
            </Typography>
            <Typography variant="h2" sx={{ mt: 0.6 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <TextField
          select
          size="small"
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as WaitlistRole | "all")}
          sx={{ width: 140 }}
        >
          {roles.map((item) => (
            <MenuItem key={item} value={item}>
              {item === "all" ? "Everyone" : roleLabel(item)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as WaitlistStatus | "all")}
          sx={{ width: 150 }}
        >
          {statuses.map((item) => (
            <MenuItem key={item} value={item}>
              {titleCase(item)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ width: { xs: "100%", sm: 280 }, ml: { sm: "auto" } }}
        />
      </Box>

      {error ? (
        <Typography color="error" sx={{ mb: 1.5, fontSize: 14 }}>
          {error}
        </Typography>
      ) : null}

      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Person</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No waitlist entries in this filter.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Loading waitlist…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((row) => {
              const name = `${row.firstName} ${row.lastName}`.trim();
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Box sx={{ fontWeight: 700 }}>{name}</Box>
                    <Box sx={{ color: "text.secondary", fontSize: 12 }}>{row.source}</Box>
                  </TableCell>
                  <TableCell>
                    <Pill tone={row.role === "driver" ? "warn" : "ok"}>{roleLabel(row.role)}</Pill>
                  </TableCell>
                  <TableCell>{row.city}</TableCell>
                  <TableCell>
                    <Box sx={{ fontWeight: 600 }}>{row.phone}</Box>
                    {row.email ? (
                      <Box sx={{ color: "text.secondary", fontSize: 13 }}>{row.email}</Box>
                    ) : null}
                  </TableCell>
                  <TableCell>{ago(row.createdAt)}</TableCell>
                  <TableCell>
                    {edit ? (
                      <TextField
                        select
                        size="small"
                        value={row.status}
                        disabled={savingId === row.id}
                        onChange={(event) => void setEntryStatus(row.id, event.target.value as WaitlistStatus)}
                        sx={{ minWidth: 140 }}
                      >
                        {(["new", "contacted", "invited", "archived"] as WaitlistStatus[]).map((item) => (
                          <MenuItem key={item} value={item}>
                            {titleCase(item)}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Pill tone={statusTone(row.status)}>{titleCase(row.status)}</Pill>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
