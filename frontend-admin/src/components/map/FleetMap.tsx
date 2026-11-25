"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import { cityCenters, fromGrid, ringLatLng, type LatLng } from "@/lib/geo";
import type { CityId } from "@/lib/types";

export interface MapRegion {
  id: string;
  name: string;
  kind: "ride" | "delivery";
  active: boolean;
  city?: CityId;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type MapMarkerStatus = "offline" | "available" | "on_trip" | "busy";

export interface MapMarker {
  id: string;
  name: string;
  /** Seed grid fallback when lat/lng missing */
  x?: number;
  y?: number;
  lat?: number | null;
  lng?: number | null;
  online: boolean;
  /** Degrees from north (0 = up / north, 90 = east). */
  heading?: number | null;
  status?: MapMarkerStatus;
  /** Along / pool occupancy */
  along?: boolean;
  poolTaken?: number;
  poolTotal?: number;
}

export interface MapSearcher {
  id: string;
  name: string;
  x?: number;
  y?: number;
  lat?: number | null;
  lng?: number | null;
  /** Live ping vs fixed pickup pin */
  live?: boolean;
  label?: string;
}

export interface MapLink {
  id: string;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  /** Closest driver can already see this searcher */
  ok?: boolean;
  label?: string;
}

function mapsKey() {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "").trim();
}

function resolvePoint(
  city: CityId,
  lat: number | null | undefined,
  lng: number | null | undefined,
  x: number | undefined,
  y: number | undefined,
): LatLng | null {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }
  if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
    return fromGrid(city, x, y);
  }
  return null;
}

function markerFill(status: MapMarkerStatus | undefined, online: boolean, accent: string) {
  if (!online || status === "offline") return "#6B6256";
  if (status === "on_trip") return "#75E0A7";
  if (status === "busy") return "#FEC84B";
  return accent;
}

/** Top-down car pointing north (−y). Rotation uses GPS heading. */
function CarGlyph({
  fill,
  stroke,
  selected,
  poolTaken = 0,
}: {
  fill: string;
  stroke: string;
  selected: boolean;
  poolTaken?: number;
}) {
  const scale = selected ? 1.2 : 1;
  const seats = [
    { x: -0.45, y: 0.95 },
    { x: 0.45, y: 0.95 },
    { x: 0, y: -0.55 },
  ];
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M -1.15 -2.35
           C -1.05 -2.85, -0.55 -3.15, 0 -3.15
           C 0.55 -3.15, 1.05 -2.85, 1.15 -2.35
           L 1.35 -0.85
           L 1.45 1.55
           C 1.45 2.15, 0.95 2.55, 0.35 2.55
           L -0.35 2.55
           C -0.95 2.55, -1.45 2.15, -1.45 1.55
           L -1.35 -0.85
           Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.28"
        strokeLinejoin="round"
      />
      <path d="M -0.75 -1.55 L 0.75 -1.55 L 0.85 -0.15 L -0.85 -0.15 Z" fill={stroke} opacity="0.35" />
      <path d="M -0.7 0.55 L 0.7 0.55 L 0.55 1.55 L -0.55 1.55 Z" fill={stroke} opacity="0.28" />
      <path d="M 0 -3.05 L 0.45 -2.15 L -0.45 -2.15 Z" fill={stroke} />
      <rect x="-1.55" y="-1.85" width="0.45" height="0.85" rx="0.15" fill={stroke} />
      <rect x="1.1" y="-1.85" width="0.45" height="0.85" rx="0.15" fill={stroke} />
      <rect x="-1.55" y="0.85" width="0.45" height="0.85" rx="0.15" fill={stroke} />
      <rect x="1.1" y="0.85" width="0.45" height="0.85" rx="0.15" fill={stroke} />
      {seats.slice(0, Math.min(3, Math.max(0, poolTaken))).map((seat, index) => (
        <circle key={index} cx={seat.x} cy={seat.y} r="0.38" fill="#60A5FA" stroke={stroke} strokeWidth="0.12" />
      ))}
    </g>
  );
}

function DriverPin({
  name,
  fill,
  heading,
  selected,
  online,
  along,
  poolTaken,
  poolTotal,
  onClick,
}: {
  name: string;
  fill: string;
  heading: number;
  selected: boolean;
  online: boolean;
  along?: boolean;
  poolTaken?: number;
  poolTotal?: number;
  onClick: () => void;
}) {
  const taken = poolTaken ?? 0;
  const total = poolTotal ?? 3;
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        transform: "translateY(-6px)",
      }}
    >
      <Typography
        sx={{
          mb: 0.4,
          px: 0.75,
          py: 0.15,
          borderRadius: 1,
          bgcolor: "rgba(10,8,6,0.78)",
          color: "#F6F1E6",
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        }}
      >
        {name.split(" ")[0]}
        {along && taken > 0 ? ` · Along ${taken}/${total}` : ""}
      </Typography>
      <Box
        sx={{
          width: selected ? 58 : 50,
          height: selected ? 58 : 50,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: online ? `${fill}22` : "transparent",
          boxShadow: online ? `0 0 0 2px ${fill}55` : "none",
        }}
      >
        <svg
          width={selected ? 46 : 40}
          height={selected ? 46 : 40}
          viewBox="-4 -4.5 8 9.5"
          style={{ transform: `rotate(${heading}deg)`, display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))" }}
        >
          <CarGlyph fill={fill} stroke="#14110E" selected={selected} poolTaken={taken} />
          {online ? <line x1="0" y1="-3.4" x2="0" y2="-4.6" stroke={fill} strokeWidth="0.35" strokeLinecap="round" /> : null}
        </svg>
      </Box>
    </Box>
  );
}

function SearcherPin({
  name,
  label,
  active,
  onClick,
}: {
  name: string;
  label?: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: onClick ? "pointer" : "default",
        transform: "translateY(-4px)",
      }}
    >
      <Typography
        sx={{
          mb: 0.4,
          px: 0.75,
          py: 0.15,
          borderRadius: 1,
          bgcolor: "rgba(10,8,6,0.78)",
          color: "#F6F1E6",
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {name.split(" ")[0]}
        {label ? ` · ${label}` : ""}
      </Typography>
      <Box
        sx={{
          width: active ? 18 : 14,
          height: active ? 18 : 14,
          borderRadius: "50%",
          bgcolor: "#60A5FA",
          border: "2px solid #14110E",
          boxShadow: "0 0 0 6px rgba(96,165,250,0.28)",
        }}
      />
    </Box>
  );
}

function ZonePolygons({ city, regions }: { city: CityId; regions: MapRegion[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const shapes: google.maps.Polygon[] = [];
    for (const region of regions.filter((item) => item.active)) {
      const path = ringLatLng(region.city ?? city, region.cx, region.cy, region.rx, region.ry);
      const ride = region.kind === "ride";
      shapes.push(
        new google.maps.Polygon({
          paths: path,
          map,
          strokeColor: ride ? "#E2B657" : "#D6F25C",
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: ride ? "#E2B657" : "#D6F25C",
          fillOpacity: 0.16,
          clickable: false,
        }),
      );
    }
    return () => {
      for (const shape of shapes) shape.setMap(null);
    };
  }, [map, regions, city]);
  return null;
}

function LinkPolylines({
  city,
  links,
  selectedSearcher,
}: {
  city: CityId;
  links: MapLink[];
  selectedSearcher?: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const lines: google.maps.Polyline[] = [];
    const labels: google.maps.marker.AdvancedMarkerElement[] = [];
    const MarkerEl = google.maps.marker?.AdvancedMarkerElement;
    for (const link of links) {
      const from = resolvePoint(city, link.fromLat, link.fromLng, link.fromX, link.fromY);
      const to = resolvePoint(city, link.toLat, link.toLng, link.toX, link.toY);
      if (!from || !to) continue;
      const active = !selectedSearcher || selectedSearcher === link.id;
      const color = link.ok ? "#75E0A7" : "#FEC84B";
      lines.push(
        new google.maps.Polyline({
          path: [from, to],
          map,
          strokeColor: color,
          strokeOpacity: active ? (link.ok ? 0.95 : 0) : 0.25,
          strokeWeight: active ? 3 : 2,
          geodesic: true,
          icons: link.ok
            ? undefined
            : [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: active ? 0.95 : 0.3, scale: 3, strokeColor: color },
                  offset: "0",
                  repeat: "12px",
                },
              ],
        }),
      );
      if (link.label && active && MarkerEl) {
        const chip = document.createElement("div");
        chip.textContent = link.label;
        chip.style.cssText = [
          "color:" + color,
          "font:700 12px/1.2 'DM Sans',Inter,sans-serif",
          "white-space:nowrap",
          "pointer-events:none",
          "text-shadow:0 1px 2px rgba(0,0,0,0.65)",
        ].join(";");
        labels.push(
          new MarkerEl({
            map,
            position: { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 },
            content: chip,
            gmpClickable: false,
          }),
        );
      }
    }
    return () => {
      for (const line of lines) line.setMap(null);
      for (const label of labels) {
        label.map = null;
      }
    };
  }, [map, links, city, selectedSearcher]);
  return null;
}

function FitBounds({ city, points, fitKey }: { city: CityId; points: LatLng[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    if (points.length === 0) {
      map.setCenter(cityCenters[city]);
      map.setZoom(12);
      return;
    }
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) bounds.extend(point);
    map.fitBounds(bounds, 64);
  }, [map, city, points, fitKey]);
  return null;
}

function MapBody({
  city,
  regions,
  markers,
  searchers,
  links,
  selected,
  selectedSearcher,
  onSelect,
  onSelectSearcher,
}: {
  city: CityId;
  regions: MapRegion[];
  markers: MapMarker[];
  searchers: MapSearcher[];
  links: MapLink[];
  selected: string | null;
  selectedSearcher?: string | null;
  onSelect: (id: string) => void;
  onSelectSearcher?: (id: string) => void;
}) {
  const accent = "#E2B657";

  const markerPoints = useMemo(
    () =>
      markers
        .map((marker) => {
          const point = resolvePoint(city, marker.lat, marker.lng, marker.x, marker.y);
          return point ? { marker, point } : null;
        })
        .filter((row): row is { marker: MapMarker; point: LatLng } => Boolean(row)),
    [markers, city],
  );

  const searcherPoints = useMemo(
    () =>
      searchers
        .map((searcher) => {
          const point = resolvePoint(city, searcher.lat, searcher.lng, searcher.x, searcher.y);
          return point ? { searcher, point } : null;
        })
        .filter((row): row is { searcher: MapSearcher; point: LatLng } => Boolean(row)),
    [searchers, city],
  );

  const fitPoints = useMemo(
    () => [...markerPoints.map((row) => row.point), ...searcherPoints.map((row) => row.point)],
    [markerPoints, searcherPoints],
  );

  const fitKey = useMemo(
    () => fitPoints.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|"),
    [fitPoints],
  );

  return (
    <Map
      key={city}
      defaultCenter={cityCenters[city]}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl
      mapId="DEMO_MAP_ID"
      colorScheme="DARK"
      style={{ width: "100%", height: "100%", backgroundColor: "#1d1b16" }}
    >
      <FitBounds city={city} points={fitPoints} fitKey={fitKey} />
      <ZonePolygons city={city} regions={regions} />
      <LinkPolylines city={city} links={links} selectedSearcher={selectedSearcher} />

      {searcherPoints.map(({ searcher, point }) => (
        <AdvancedMarker
          key={`search-${searcher.id}`}
          position={point}
          title={searcher.name}
          zIndex={selectedSearcher === searcher.id ? 40 : 25}
          onClick={() => onSelectSearcher?.(searcher.id)}
        >
          <SearcherPin
            name={searcher.name}
            label={searcher.label}
            active={selectedSearcher === searcher.id}
            onClick={onSelectSearcher ? () => onSelectSearcher(searcher.id) : undefined}
          />
        </AdvancedMarker>
      ))}

      {markerPoints.map(({ marker, point }) => {
        const fill = markerFill(marker.status, marker.online, accent);
        const heading = Number.isFinite(marker.heading) ? Number(marker.heading) : 0;
        return (
          <AdvancedMarker
            key={marker.id}
            position={point}
            title={marker.name}
            zIndex={selected === marker.id ? 30 : marker.online ? 20 : 10}
            onClick={() => onSelect(marker.id)}
          >
            <DriverPin
              name={marker.name}
              fill={fill}
              heading={heading}
              selected={selected === marker.id}
              online={marker.online}
              along={marker.along}
              poolTaken={marker.poolTaken}
              poolTotal={marker.poolTotal}
              onClick={() => onSelect(marker.id)}
            />
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

export function FleetMap({
  city = "abuja",
  regions,
  markers,
  searchers = [],
  links = [],
  selected,
  selectedSearcher,
  onSelect,
  onSelectSearcher,
}: {
  city?: CityId;
  regions: MapRegion[];
  markers: MapMarker[];
  searchers?: MapSearcher[];
  links?: MapLink[];
  selected: string | null;
  selectedSearcher?: string | null;
  onSelect: (id: string) => void;
  onSelectSearcher?: (id: string) => void;
}) {
  const dark = useTheme().palette.mode === "dark";
  const key = mapsKey();

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px",
        overflow: "hidden",
        bgcolor: dark ? "#14110E" : "#1d1b16",
        height: { xs: 420, md: 560 },
        position: "relative",
      }}
    >
      {!key ? (
        <Box sx={{ height: "100%", display: "grid", placeItems: "center", px: 3 }}>
          <Typography color="text.secondary" sx={{ textAlign: "center" }}>
            Set <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> in the admin env to load Google Maps.
          </Typography>
        </Box>
      ) : (
        <APIProvider apiKey={key} libraries={["marker"]}>
          <MapBody
            city={city}
            regions={regions}
            markers={markers}
            searchers={searchers}
            links={links}
            selected={selected}
            selectedSearcher={selectedSearcher}
            onSelect={onSelect}
            onSelectSearcher={onSelectSearcher}
          />
        </APIProvider>
      )}
    </Box>
  );
}
