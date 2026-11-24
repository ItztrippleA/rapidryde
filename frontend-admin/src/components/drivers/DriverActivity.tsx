"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
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
import { Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { ago, cityLabel, titleCase } from "@/lib/format";
import type { CityId } from "@/lib/types";

type Duty = "offline" | "available" | "on_trip" | "busy";

type LiveRow = {
  driverId: string;
  name: string;
  phone: string;
  status: Duty;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
  activeRideId: string | null;
  lastSeenAt: number | null;
  accountStatus?: string;
};

type Filter = "all" | "online" | "stale" | "offline";

const STALE_MS = 5 * 60_000;

function dutyTone(status: Duty) {
  if (status === "on_trip") return "ok" as const;
  if (status === "busy") return "warn" as const;
  if (status === "available") return "ok" as const;
  return "off" as const;
}

function freshnessTone(at: number | null | undefined, online: boolean, now: number) {
  if (at == null || at <= 0) return "off" as const;
  const age = now - at;
  if (online && age < 60_000) return "ok" as const;
  if (age < STALE_MS) return "warn" as const;
  return "hot" as const;
}

export function DriverActivity() {
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [source, setSource] = useState<"api" | "offline">("offline");
  const [error, setError] = useState("");
  const [city, setCity] = useState<CityId | "all">("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const stamp = Date.now();
    setNow(stamp);
    if (!hasApi()) {
      setRows([]);
      setSource("offline");
      return;
    }
    try {
      setError("");
      const { token } = await adminLogin();
      const query = city === "all" ? "onlineOnly=false" : `city=${city}&onlineOnly=false`;
      const live = await api<LiveRow[]>(`/admin/drivers/live?${query}`, { token });
      setRows(live);
      setSource("api");
    } catch (err) {
      setRows([]);
      setSource("offline");
      setError(err instanceof Error ? err.message : "Presence unavailable");
    }
  }, [city]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aAt = a.lastSeenAt ?? 0;
      const bAt = b.lastSeenAt ?? 0;
      if (a.online !== b.online) return a.online ? -1 : 1;
      return bAt - aAt;
    });
  }, [rows]);

  const visible = useMemo(() => {
    return sorted.filter((row) => {
      const age = row.lastSeenAt ? now - row.lastSeenAt : Number.POSITIVE_INFINITY;
      if (filter === "online") return row.online;
      if (filter === "offline") return !row.online;
      if (filter === "stale") return row.online && age >= STALE_MS;
      return true;
    });
  }, [sorted, filter, now]);

  const onlineCount = sorted.filter((row) => row.online).length;
  const onTrip = sorted.filter((row) => row.status === "on_trip").length;
  const staleCount = sorted.filter((row) => row.online && row.lastSeenAt != null && now - row.lastSeenAt >= STALE_MS).length;

  return (
    <Box sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography sx={{ fontWeight: 800 }}>Driver activity</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
            Last seen from presence pings{source === "api" ? " · live" : " · waiting for API"}.
          </Typography>
        </Box>
        <Pill tone="ok">{onlineCount} online</Pill>
        <Pill tone={onTrip ? "ok" : "off"}>{onTrip} on trip</Pill>
        <Pill tone={staleCount ? "hot" : "off"}>{staleCount} stale</Pill>
        <TextField
          select
          size="small"
          label="City"
          value={city}
          onChange={(event) => setCity(event.target.value as CityId | "all")}
          sx={{ width: 120 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="abuja">Abuja</MenuItem>
          <MenuItem value="lagos">Lagos</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Show"
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          sx={{ width: 130 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="online">Online</MenuItem>
          <MenuItem value="stale">Stale</MenuItem>
          <MenuItem value="offline">Offline</MenuItem>
        </TextField>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => setTick((value) => value + 1)}>
          Refresh
        </Button>
      </Box>
      {error ? (
        <Typography sx={{ px: 2, py: 1, color: "warning.main", fontSize: 13 }}>{error}</Typography>
      ) : null}
      <Box sx={{ overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Driver</TableCell>
              <TableCell>Duty</TableCell>
              <TableCell>Presence</TableCell>
              <TableCell>Last seen</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Active ride</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography sx={{ color: "text.secondary", py: 2 }}>No drivers match this filter.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.driverId} hover>
                  <TableCell>
                    <Box sx={{ fontWeight: 700 }}>{row.name || row.driverId}</Box>
                    <Box sx={{ color: "text.secondary", fontSize: 13 }}>{row.phone || "—"}</Box>
                  </TableCell>
                  <TableCell>
                    <Pill tone={dutyTone(row.status)}>{titleCase(row.status)}</Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone={row.online ? "ok" : "off"}>{row.online ? "Online" : "Offline"}</Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone={freshnessTone(row.lastSeenAt, row.online, now)}>{ago(row.lastSeenAt, now)}</Pill>
                    {row.lastSeenAt ? (
                      <Box sx={{ color: "text.secondary", fontSize: 12, mt: 0.4 }}>
                        {new Date(row.lastSeenAt).toLocaleString()}
                      </Box>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.city === "abuja" || row.city === "lagos" ? cityLabel(row.city) : row.city || "—"}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                    {row.activeRideId || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
