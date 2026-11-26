"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef } from "react";
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

/** Active trip corridor for the fleet map (pickup → stops → dropoff). */
export interface MapTripRoute {
  id: string;
  status: string;
  label?: string;
  pickup: LatLng;
  dropoff: LatLng;
  stops?: LatLng[];
  /** Live driver ping (prefer presence). */
  driver?: LatLng | null;
  /** Live customer ping while on trip. */
  customer?: LatLng | null;
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

/** Top-down car (nose = north). Rotates with GPS heading. */
function DriverCar({
  fill,
  heading,
  selected,
  online,
  along,
  poolTaken = 0,
}: {
  fill: string;
  heading: number;
  selected: boolean;
  online: boolean;
  along?: boolean;
  poolTaken?: number;
}) {
  const size = selected ? 44 : 36;
  const body = online ? fill : "#8A8174";
  const seats = [
    { cx: 10.5, cy: 14 },
    { cx: 17.5, cy: 14 },
    { cx: 14, cy: 22 },
  ];
  return (
    <Box
      sx={{
        width: size,
        height: size * 1.25,
        display: "grid",
        placeItems: "center",
        filter: selected
          ? `drop-shadow(0 0 0 2px ${fill}) drop-shadow(0 2px 6px rgba(0,0,0,0.55))`
          : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        opacity: online ? 1 : 0.55,
      }}
    >
      <svg
        width={size}
        height={size * 1.25}
        viewBox="0 0 28 36"
        style={{ transform: `rotate(${heading}deg)`, display: "block" }}
      >
        <ellipse cx="14" cy="21" rx="8" ry="11" fill="rgba(0,0,0,0.28)" />
        <path
          d="M8.4 12C8.4 6 10.8 2.5 14 2.5C17.2 2.5 19.6 6 19.6 12L20.2 25C20.2 32 17.6 34.2 14 34.2C10.4 34.2 7.8 32 7.8 25Z"
          fill={body}
          stroke="#14110E"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path d="M10.2 11C10.5 7.6 17.5 7.6 17.8 11L17.3 14.6C14 13.4 10.7 13.4 10.7 14.6Z" fill="#E7F6FF" />
        <path d="M10.6 24.5C11 27.4 17 27.4 17.4 24.5L16.8 22C14 23.2 11.2 23.2 11.2 22Z" fill="#1A140C" opacity={0.45} />
        <rect x="2.4" y="10" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <rect x="22.4" y="10" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <rect x="2.4" y="21" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        <rect x="22.4" y="21" width="3.2" height="6.4" rx="1.1" fill="#1A140C" />
        {along
          ? seats.slice(0, Math.min(3, Math.max(0, poolTaken))).map((seat, index) => (
              <circle key={index} cx={seat.cx} cy={seat.cy} r="2.1" fill="#60A5FA" stroke="#14110E" strokeWidth="0.6" />
            ))
          : null}
      </svg>
    </Box>
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
      }}
    >
      <Typography
        sx={{
          mb: 0.35,
          px: 0.75,
          py: 0.15,
          borderRadius: 1,
          bgcolor: "rgba(10,8,6,0.78)",
          color: "#F6F1E6",
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      >
        {name.split(" ")[0]}
        {along && taken > 0 ? ` · Along ${taken}/${total}` : ""}
      </Typography>
      <DriverCar
        fill={fill}
        heading={heading}
        selected={selected}
        online={online}
        along={along}
        poolTaken={taken}
      />
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
  const lastKey = useRef("");
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    // Only re-fit when the set of entities changes — not on every GPS poll.
    if (fitKey === lastKey.current) return;
    lastKey.current = fitKey;
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

type TripOverlay = {
  corridor: google.maps.Polyline;
  approach: google.maps.Polyline | null;
  pickup: google.maps.marker.AdvancedMarkerElement | null;
  dropoff: google.maps.marker.AdvancedMarkerElement | null;
  rider: google.maps.marker.AdvancedMarkerElement | null;
};

function makeChip(text: string, color: string) {
  const chip = document.createElement("div");
  chip.textContent = text;
  chip.style.cssText = [
    `color:${color}`,
    "font:700 11px/1.2 'DM Sans',Inter,sans-serif",
    "padding:2px 6px",
    "border-radius:8px",
    "background:rgba(10,8,6,0.78)",
    "white-space:nowrap",
    "pointer-events:none",
  ].join(";");
  return chip;
}

function approachIcons(active: boolean): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: active ? 0.95 : 0.35,
        scale: 3,
        strokeColor: "#75E0A7",
      },
      offset: "0",
      repeat: "10px",
    },
  ];
}

/** Draw active trip pickup→dropoff corridors + approach legs from the live car. */
function TripRoutes({ trips, selectedId }: { trips: MapTripRoute[]; selectedId?: string | null }) {
  const map = useMap();
  const overlays = useRef(new Map<string, TripOverlay>());

  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const MarkerEl = google.maps.marker?.AdvancedMarkerElement;
    const seen = new Set<string>();

    for (const trip of trips) {
      seen.add(trip.id);
      const active = !selectedId || selectedId === trip.id;
      const corridorPath = [trip.pickup, ...(trip.stops ?? []), trip.dropoff];
      const target =
        trip.status === "on_trip" || trip.status === "completed" ? trip.dropoff : trip.pickup;
      let overlay = overlays.current.get(trip.id);

      if (!overlay) {
        const corridor = new google.maps.Polyline({
          path: corridorPath,
          map,
          strokeColor: "#FF6A00",
          strokeOpacity: active ? 0.95 : 0.35,
          strokeWeight: active ? 5 : 3,
          geodesic: true,
        });
        const approach = trip.driver
          ? new google.maps.Polyline({
              path: [trip.driver, target],
              map,
              strokeColor: "#75E0A7",
              strokeOpacity: 0,
              strokeWeight: 0,
              geodesic: true,
              icons: approachIcons(active),
            })
          : null;
        const pickup =
          MarkerEl != null
            ? new MarkerEl({
                map,
                position: trip.pickup,
                content: makeChip("P", "#D6F25C"),
                gmpClickable: false,
                zIndex: active ? 50 : 20,
              })
            : null;
        const dropoff =
          MarkerEl != null
            ? new MarkerEl({
                map,
                position: trip.dropoff,
                content: makeChip("D", "#FF6A00"),
                gmpClickable: false,
                zIndex: active ? 50 : 20,
              })
            : null;
        const rider =
          MarkerEl != null && trip.customer
            ? new MarkerEl({
                map,
                position: trip.customer,
                content: makeChip("Rider", "#60A5FA"),
                gmpClickable: false,
                zIndex: active ? 50 : 20,
              })
            : null;
        overlay = { corridor, approach, pickup, dropoff, rider };
        overlays.current.set(trip.id, overlay);
        continue;
      }

      overlay.corridor.setPath(corridorPath);
      overlay.corridor.setOptions({
        strokeOpacity: active ? 0.95 : 0.35,
        strokeWeight: active ? 5 : 3,
      });

      if (trip.driver) {
        if (overlay.approach) {
          overlay.approach.setPath([trip.driver, target]);
          overlay.approach.setOptions({ icons: approachIcons(active) });
        } else {
          overlay.approach = new google.maps.Polyline({
            path: [trip.driver, target],
            map,
            strokeColor: "#75E0A7",
            strokeOpacity: 0,
            strokeWeight: 0,
            geodesic: true,
            icons: approachIcons(active),
          });
        }
      } else if (overlay.approach) {
        overlay.approach.setMap(null);
        overlay.approach = null;
      }

      if (overlay.pickup) {
        overlay.pickup.position = trip.pickup;
        overlay.pickup.zIndex = active ? 50 : 20;
      }
      if (overlay.dropoff) {
        overlay.dropoff.position = trip.dropoff;
        overlay.dropoff.zIndex = active ? 50 : 20;
      }
      if (trip.customer) {
        if (overlay.rider) {
          overlay.rider.position = trip.customer;
          overlay.rider.zIndex = active ? 50 : 20;
        } else if (MarkerEl) {
          overlay.rider = new MarkerEl({
            map,
            position: trip.customer,
            content: makeChip("Rider", "#60A5FA"),
            gmpClickable: false,
            zIndex: active ? 50 : 20,
          });
        }
      } else if (overlay.rider) {
        overlay.rider.map = null;
        overlay.rider = null;
      }
    }

    for (const [id, overlay] of overlays.current) {
      if (seen.has(id)) continue;
      overlay.corridor.setMap(null);
      overlay.approach?.setMap(null);
      if (overlay.pickup) overlay.pickup.map = null;
      if (overlay.dropoff) overlay.dropoff.map = null;
      if (overlay.rider) overlay.rider.map = null;
      overlays.current.delete(id);
    }
  }, [map, trips, selectedId]);

  useEffect(() => {
    return () => {
      for (const overlay of overlays.current.values()) {
        overlay.corridor.setMap(null);
        overlay.approach?.setMap(null);
        if (overlay.pickup) overlay.pickup.map = null;
        if (overlay.dropoff) overlay.dropoff.map = null;
        if (overlay.rider) overlay.rider.map = null;
      }
      overlays.current.clear();
    };
  }, []);

  return null;
}

function MapBody({
  city,
  regions,
  markers,
  searchers,
  links,
  trips = [],
  selected,
  selectedSearcher,
  selectedTripId,
  onSelect,
  onSelectSearcher,
}: {
  city: CityId;
  regions: MapRegion[];
  markers: MapMarker[];
  searchers: MapSearcher[];
  links: MapLink[];
  trips?: MapTripRoute[];
  selected: string | null;
  selectedSearcher?: string | null;
  selectedTripId?: string | null;
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

  const tripPoints = useMemo(() => {
    const points: LatLng[] = [];
    for (const trip of trips) {
      // Fit to fixed corridor ends — ignore live driver/rider pings so polls don't reframe the map.
      points.push(trip.pickup, trip.dropoff, ...(trip.stops ?? []));
    }
    return points;
  }, [trips]);

  const fitPoints = useMemo(
    () => [
      ...markerPoints.map((row) => row.point),
      ...searcherPoints.map((row) => row.point),
      ...tripPoints,
    ],
    [markerPoints, searcherPoints, tripPoints],
  );

  // Structural key only — entity set / city, not live coordinates.
  const fitKey = useMemo(
    () =>
      [
        city,
        ...markers.map((marker) => marker.id).sort(),
        ...searchers.map((searcher) => searcher.id).sort(),
        ...trips.map((trip) => trip.id).sort(),
      ].join("|"),
    [city, markers, searchers, trips],
  );

  return (
    <GoogleMap
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
      <TripRoutes trips={trips} selectedId={selectedTripId || selectedSearcher} />
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
    </GoogleMap>
  );
}

export function FleetMap({
  city = "abuja",
  regions,
  markers,
  searchers = [],
  links = [],
  trips = [],
  selected,
  selectedSearcher,
  selectedTripId,
  onSelect,
  onSelectSearcher,
}: {
  city?: CityId;
  regions: MapRegion[];
  markers: MapMarker[];
  searchers?: MapSearcher[];
  links?: MapLink[];
  trips?: MapTripRoute[];
  selected: string | null;
  selectedSearcher?: string | null;
  selectedTripId?: string | null;
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
            trips={trips}
            selected={selected}
            selectedSearcher={selectedSearcher}
            selectedTripId={selectedTripId}
            onSelect={onSelect}
            onSelectSearcher={onSelectSearcher}
          />
        </APIProvider>
      )}
    </Box>
  );
}
