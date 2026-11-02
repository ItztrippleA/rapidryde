"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { FleetMap } from "@/components/map/FleetMap";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { inside, ring } from "@/lib/geo";
import { cityLabel } from "@/lib/format";
import type { CityId } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

export function MapView() {
  const drivers = useAdminStore((state) => state.drivers);
  const rideZones = useAdminStore((state) => state.rideZones);
  const deliveryZones = useAdminStore((state) => state.deliveryZones);
  const [city, setCity] = useState<CityId>("abuja");
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});

  const cityDrivers = drivers.filter((driver) => driver.city === city);
  const visible = cityDrivers.filter((driver) => (onlineOnly ? driver.online : true));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLive((current) => {
        const next = { ...current };
        for (const driver of drivers) {
          if (!driver.online) continue;
          const point = next[driver.id] ?? { x: driver.x, y: driver.y };
          next[driver.id] = {
            x: Math.min(96, Math.max(4, point.x + (Math.random() - 0.5) * 1.6)),
            y: Math.min(96, Math.max(4, point.y + (Math.random() - 0.5) * 1.6)),
          };
        }
        return next;
      });
    }, 1700);
    return () => window.clearInterval(timer);
  }, [drivers]);

  const pointFor = (id: string, x: number, y: number) => live[id] ?? { x, y };

  return (
    <Box>
      <PageHeader kicker="Operations" title="Fleet map" lede="Online drivers move on the city grid. Ride zones use gold in dark mode and orange in light mode. Delivery zones use lemon." />
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        {(["abuja", "lagos"] as const).map((id) => (
          <Button key={id} variant={city === id ? "contained" : "outlined"} onClick={() => setCity(id)}>{cityLabel(id)}</Button>
        ))}
        <Button variant={onlineOnly ? "contained" : "outlined"} onClick={() => setOnlineOnly((value) => !value)}>{onlineOnly ? "Online only" : "All drivers"}</Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) minmax(280px, 0.7fr)" }, gap: 2 }}>
        <FleetMap
          selected={selected}
          onSelect={setSelected}
          regions={[
            ...rideZones.filter((zone) => zone.city === city).map((zone) => ({ ...zone, kind: "ride" as const })),
            ...deliveryZones.filter((zone) => zone.city === city).map((zone) => ({ ...zone, kind: "delivery" as const })),
          ]}
          markers={visible.map((driver) => {
            const point = pointFor(driver.id, driver.x, driver.y);
            return { id: driver.id, name: driver.name, x: point.x, y: point.y, online: driver.online };
          })}
        />
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "auto", maxHeight: { lg: 560 } }}>
          <Typography sx={{ px: 2, pt: 2, fontWeight: 700 }}>Current locations</Typography>
          <Typography color="text.secondary" sx={{ px: 2, pb: 1, fontSize: 13 }}>{visible.filter((driver) => driver.online).length} online in {cityLabel(city)}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Driver</TableCell>
                <TableCell>Zone</TableCell>
                <TableCell>Grid</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((driver) => {
                const point = pointFor(driver.id, driver.x, driver.y);
                const zone = rideZones.find((item) => item.city === city && item.active && inside(point, ring(item.cx, item.cy, item.rx, item.ry)));
                return (
                  <TableRow key={driver.id} hover selected={selected === driver.id} onClick={() => setSelected(driver.id)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      <Box sx={{ fontWeight: 700 }}>{driver.name}</Box>
                      <Pill tone={driver.online ? "ok" : "off"}>{driver.online ? "Online" : "Offline"}</Pill>
                    </TableCell>
                    <TableCell>{zone?.name ?? "Outside a ride zone"}</TableCell>
                    <TableCell>{point.x.toFixed(1)}, {point.y.toFixed(1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
