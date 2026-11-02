"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import { pointsAttr, ring, type Point } from "@/lib/geo";

export interface MapRegion {
  id: string;
  name: string;
  kind: "ride" | "delivery";
  active: boolean;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface MapMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  online: boolean;
}

const roads = [
  "M 4 28 C 28 24, 48 36, 96 20",
  "M 6 62 C 30 54, 58 74, 97 66",
  "M 24 4 C 22 30, 36 58, 34 97",
  "M 68 3 C 66 28, 78 52, 82 98",
  "M 8 84 C 40 78, 70 88, 96 80",
];

export function FleetMap({
  regions,
  markers,
  selected,
  onSelect,
}: {
  regions: MapRegion[];
  markers: MapMarker[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const dark = useTheme().palette.mode === "dark";
  const ink = dark ? "#2C261E" : "#E7E2D6";
  const rideFill = dark ? "rgba(226,182,87,0.16)" : "rgba(255,106,0,0.12)";
  const deliveryFill = dark ? "rgba(143,184,0,0.16)" : "rgba(214,242,92,0.45)";
  const rideStroke = dark ? "#E2B657" : "#FF6A00";
  const deliveryStroke = dark ? "#D6F25C" : "#8FB800";
  const online = dark ? "#E2B657" : "#FF6A00";

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", overflow: "hidden", bgcolor: dark ? "#14110E" : "#F8F6EF", height: { xs: 420, md: 560 } }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="Operating map with driver positions">
        {Array.from({ length: 10 }, (_, index) => (
          <g key={index} stroke={ink} strokeWidth="0.15">
            <line x1={index * 10} y1="0" x2={index * 10} y2="100" />
            <line x1="0" y1={index * 10} x2="100" y2={index * 10} />
          </g>
        ))}
        {roads.map((d) => (
          <path key={d} d={d} fill="none" stroke={dark ? "#3A3228" : "#D9D1C3"} strokeWidth="1.1" strokeLinecap="round" />
        ))}
        {regions.filter((region) => region.active).map((region) => {
          const shape: Point[] = ring(region.cx, region.cy, region.rx, region.ry);
          return (
            <polygon
              key={region.id}
              points={pointsAttr(shape)}
              fill={region.kind === "ride" ? rideFill : deliveryFill}
              stroke={region.kind === "ride" ? rideStroke : deliveryStroke}
              strokeWidth="0.45"
            />
          );
        })}
        {markers.map((marker) => (
          <g key={marker.id} transform={`translate(${marker.x} ${marker.y})`} onClick={() => onSelect(marker.id)} style={{ cursor: "pointer" }}>
            {marker.online ? (
              <motion.circle
                r="3.2"
                fill="none"
                stroke={online}
                strokeWidth="0.35"
                initial={{ opacity: 0.7, scale: 0.7 }}
                animate={{ opacity: [0.55, 0], scale: [0.8, 2.1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            ) : null}
            <circle r={selected === marker.id ? 2.3 : 1.7} fill={marker.online ? online : dark ? "#6B6256" : "#A39888"} stroke={dark ? "#14110E" : "#FFFFFF"} strokeWidth="0.4" />
            <text y="-2.6" textAnchor="middle" fontSize="2.4" fontFamily="Inter, sans-serif" fill={dark ? "#F6F1E6" : "#1A160C"}>
              {marker.name.split(" ")[0]}
            </text>
          </g>
        ))}
      </svg>
    </Box>
  );
}
