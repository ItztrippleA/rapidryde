"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Point } from "@/lib/series";

const swatches = ["#FF6A00", "#E2B657", "#8FB800", "#C4962E", "#D6F25C", "#6B6458"];

export function ChartCard({ title, note, children, wide }: { title: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", gridColumn: wide ? { md: "1 / -1" } : undefined, minWidth: 0 }}>
      <Typography variant="h3">{title}</Typography>
      {note ? <Typography color="text.secondary" sx={{ mt: 0.4, mb: 1.5, fontSize: 13 }}>{note}</Typography> : <Box sx={{ mb: 1.5 }} />}
      {children}
    </Box>
  );
}

export function Bars({ rows }: { rows: Point[] }) {
  const painted = rows.map((row, index) => ({ ...row, color: swatches[index % swatches.length] }));
  const max = Math.max(...painted.map((row) => row.value), 1);
  const empty = painted.every((row) => row.value === 0);
  if (empty) return <Typography color="text.secondary" sx={{ fontSize: 13 }}>Nothing to chart yet.</Typography>;
  return (
    <Box role="img" aria-label={painted.map((row) => `${row.label} ${row.display ?? row.value}`).join(", ")} sx={{ display: "grid", gap: 1.1 }}>
      {painted.map((row) => (
        <Box key={row.label}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, fontSize: 13 }}>
            <Typography sx={{ fontSize: 13, minWidth: 0 }}>{row.label}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{row.display ?? row.value}</Typography>
          </Box>
          <Box sx={{ mt: 0.45, height: 8, borderRadius: "8px", bgcolor: "action.hover", overflow: "hidden" }}>
            <Box sx={{ width: row.value === 0 ? 0 : `${Math.max(2, (row.value / max) * 100)}%`, height: "100%", borderRadius: "8px", bgcolor: row.color }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function Donut({ rows }: { rows: Point[] }) {
  const painted = rows.map((row, index) => ({ ...row, color: swatches[index % swatches.length] }));
  const active = painted.filter((row) => row.value > 0);
  const total = active.reduce((sum, row) => sum + row.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, alignItems: { sm: "center" } }}>
      <Box sx={{ width: 132, height: 132, flex: "0 0 auto", mx: { xs: "auto", sm: 0 } }}>
        <svg viewBox="0 0 120 120" width="100%" height="100%" role="img" aria-label={total === 0 ? "No figures" : active.map((row) => `${row.label} ${row.value}`).join(", ")}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="14" />
          {active.map((row) => {
            const length = (row.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const offset = -cursor;
            cursor += length;
            return <circle key={row.label} cx="60" cy="60" r={radius} fill="none" stroke={row.color} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 60 60)" />;
          })}
          <text x="60" y="64" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">{total}</text>
        </svg>
      </Box>
      <Box sx={{ display: "grid", gap: 0.7, flex: 1, minWidth: 0 }}>
        {painted.map((row) => (
          <Box key={row.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "8px", bgcolor: row.color, flex: "0 0 auto" }} />
            <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>{row.label}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.display ?? row.value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
