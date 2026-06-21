import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng, TransportMode } from "../dsl/types";
import { formatDuration } from "../lib/duration";
import type { DisplayHop, DisplayWaypoint } from "./display";

// Dashed legs read as "in the air / over water"; solid for ground transport.
const DASHED_MODES: ReadonlySet<TransportMode> = new Set(["flight", "ferry"]);

// Neutral color for start/end markers and the leg into the end point, so they
// read as structural endpoints distinct from the numbered, colored hops.
const ENDPOINT_COLOR = "#111827";

/** A point on the drawn route: the start, a hop, an overnight drive stop, or the end. */
interface RouteNode {
  id: string;
  name: string;
  location: LatLng;
  /** Marker fill; also the color of the leg arriving into this node. */
  color: string;
  kind: "start" | "hop" | "stop" | "end";
  /** Hop index (0-based) for the numbered pin label. */
  index?: number;
  /** Mode + duration of the leg arriving *into* this node. */
  arriveBy?: TransportMode;
  travelMinutes?: number;
  /** Nights spent, for drive stops. */
  nights?: number;
}

function pinIcon(color: string, label: string, active: boolean): L.DivIcon {
  return L.divIcon({
    className: "map-pin-wrapper",
    html: `<div class="map-pin${active ? " map-pin--active" : ""}" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function endpointIcon(kind: "start" | "end"): L.DivIcon {
  const glyph = kind === "start" ? "▶" : "⚑";
  return L.divIcon({
    className: "map-pin-wrapper",
    html: `<div class="map-endpoint"><span>${glyph}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function driveStopIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "map-pin-wrapper",
    html: `<div class="map-drive-stop" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function activityIcon(color: string, fixed: boolean): L.DivIcon {
  return L.divIcon({
    className: "map-activity-wrapper",
    html: `<div class="map-activity${fixed ? " map-activity--fixed" : ""}" style="background:${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function legLabelIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: "leg-label-wrapper",
    html: `<span class="leg-label">${text}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const signature = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);
  return null;
}

/** Forward map clicks (to place the active hop) without re-rendering the map. */
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

interface MapViewProps {
  hops: DisplayHop[];
  start: DisplayWaypoint | null;
  end: DisplayWaypoint | null;
  activeHopId: string | null;
  onHover: (hopId: string | null) => void;
  /** Write a hop's `coords:` after dragging its pin. */
  onHopMove: (hopId: string, lat: number, lng: number) => void;
  /** Place the active hop where the user clicked the map. */
  onMapClick: (lat: number, lng: number) => void;
}

export function MapView({
  hops,
  start,
  end,
  activeHopId,
  onHover,
  onHopMove,
  onMapClick,
}: MapViewProps) {
  // Ordered chain of located points: start → located hops → end.
  const nodes = useMemo<RouteNode[]>(() => {
    const out: RouteNode[] = [];
    if (start?.location) {
      out.push({
        id: "start",
        name: start.name,
        location: start.location,
        color: ENDPOINT_COLOR,
        kind: "start",
      });
    }
    for (const h of hops) {
      // Overnight drive stops come first, so the route threads prev hop →
      // stops → this hop as consecutive solid (car) legs.
      for (const ds of h.driveStops) {
        if (!ds.location) continue;
        out.push({
          id: ds.stop.id,
          name: ds.stop.name,
          location: ds.location,
          color: h.color,
          kind: "stop",
          arriveBy: h.hop.driveMode ?? "car",
          nights: ds.stop.nights,
        });
      }
      if (!h.location) continue;
      out.push({
        id: h.hop.id,
        name: h.hop.name,
        location: h.location,
        color: h.color,
        kind: "hop",
        index: h.index,
        arriveBy: h.hop.arriveBy,
        travelMinutes: h.hop.travelMinutes,
      });
    }
    if (end?.location) {
      out.push({
        id: "end",
        name: end.name,
        location: end.location,
        color: ENDPOINT_COLOR,
        kind: "end",
      });
    }
    return out;
  }, [start, end, hops]);

  const points = useMemo(
    () => nodes.map((n) => [n.location.lat, n.location.lng] as [number, number]),
    [nodes],
  );

  // Located activities, flattened with their hop's color and center (for the
  // connector line). Activities are not added to FitBounds — they sit near their
  // hop, and a stray geocode shouldn't blow up the route's bounds.
  const activityPins = useMemo(
    () =>
      hops.flatMap((h) =>
        h.activities
          .filter((a) => a.location)
          .map((a) => ({
            id: a.activity.id,
            name: a.activity.name,
            date: a.activity.date,
            location: a.location!,
            color: h.color,
            hopLocation: h.location,
          })),
      ),
    [hops],
  );

  return (
    <div className="map">
      <MapContainer
        center={[50, 10]}
        zoom={4}
        className="map__container"
        scrollWheelZoom
        worldCopyJump
      >
        {/* Esri World Street Map renders place names in English/Latin worldwide
            (e.g. Khmer regions show "Phnom Penh"). Note the {z}/{y}/{x} path
            order Esri uses, and no {s} subdomains. */}
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ, USGS, and others'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {nodes.map((n, i) => {
          const prev = nodes[i - 1];
          if (!prev) return null;
          const dashed = DASHED_MODES.has(n.arriveBy ?? "train");
          return (
            <Polyline
              key={`leg-${n.id}`}
              positions={[
                [prev.location.lat, prev.location.lng],
                [n.location.lat, n.location.lng],
              ]}
              pathOptions={{
                color: n.color,
                weight: 3,
                opacity: 0.75,
                dashArray: dashed ? "6 8" : undefined,
              }}
            />
          );
        })}

        {nodes.map((n, i) => {
          const prev = nodes[i - 1];
          if (!prev || n.travelMinutes == null) return null;
          const mid: [number, number] = [
            (prev.location.lat + n.location.lat) / 2,
            (prev.location.lng + n.location.lng) / 2,
          ];
          return (
            <Marker
              key={`time-${n.id}`}
              position={mid}
              icon={legLabelIcon(formatDuration(n.travelMinutes))}
              interactive={false}
              keyboard={false}
            />
          );
        })}

        {activityPins.map((a) =>
          a.hopLocation ? (
            <Polyline
              key={`acon-${a.id}`}
              positions={[
                [a.hopLocation.lat, a.hopLocation.lng],
                [a.location.lat, a.location.lng],
              ]}
              pathOptions={{ color: a.color, weight: 1, opacity: 0.4, dashArray: "2 4" }}
            />
          ) : null,
        )}

        {activityPins.map((a) => (
          <Marker
            key={`act-${a.id}`}
            position={[a.location.lat, a.location.lng]}
            icon={activityIcon(a.color, a.date != null)}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{a.name}</strong>
              {a.date && <span className="map-tooltip-sub"> · {a.date}</span>}
            </Tooltip>
          </Marker>
        ))}

        {nodes.map((n) => {
          if (n.kind === "hop") {
            return (
              <Marker
                key={n.id}
                position={[n.location.lat, n.location.lng]}
                icon={pinIcon(n.color, String((n.index ?? 0) + 1), n.id === activeHopId)}
                draggable
                eventHandlers={{
                  mouseover: () => onHover(n.id),
                  mouseout: () => onHover(null),
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onHopMove(n.id, lat, lng);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  <strong>{n.name}</strong>
                  <span className="map-tooltip-sub"> · drag to move</span>
                </Tooltip>
              </Marker>
            );
          }
          if (n.kind === "stop") {
            return (
              <Marker
                key={n.id}
                position={[n.location.lat, n.location.lng]}
                icon={driveStopIcon(n.color)}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <strong>{n.name}</strong>
                  <span className="map-tooltip-sub">
                    {" "}
                    · {n.nights} night{n.nights === 1 ? "" : "s"} (drive)
                  </span>
                </Tooltip>
              </Marker>
            );
          }
          return (
            <Marker
              key={n.id}
              position={[n.location.lat, n.location.lng]}
              icon={endpointIcon(n.kind)}
            >
              <Tooltip direction="top" offset={[0, -14]}>
                <strong>{n.name}</strong>
                <span className="map-tooltip-sub"> · {n.kind === "start" ? "Start" : "End"}</span>
              </Tooltip>
            </Marker>
          );
        })}

        <FitBounds points={points} />
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
