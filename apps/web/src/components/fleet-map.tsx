"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  plate: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  speedKmh?: number | null;
};

export type MapGeofence = {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  name: string;
};

type FleetMapProps = {
  markers: MapMarker[];
  route?: Array<{ lat: number; lng: number }>;
  geofences?: MapGeofence[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: string;
  zoom?: number;
};

const statusColor: Record<MapMarker["status"], string> = {
  ONLINE: "#22c55e",
  OFFLINE: "#94a3b8",
  UNKNOWN: "#f59e0b",
};

export function FleetMap({
  markers,
  route,
  geofences = [],
  selectedId,
  onSelect,
  height = "100%",
  zoom = 12,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    markers: L.LayerGroup;
    route: L.Polyline | null;
    geofences: L.LayerGroup;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([-23.5505, -46.6333], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const geofenceLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    layersRef.current = { markers: markerLayer, route: null, geofences: geofenceLayer };

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.markers.clearLayers();
    layers.geofences.clearLayers();

    for (const fence of geofences) {
      L.circle([fence.lat, fence.lng], {
        radius: fence.radiusMeters,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        weight: 2,
      })
        .bindTooltip(fence.name)
        .addTo(layers.geofences);
    }

    for (const m of markers) {
      const isSelected = m.id === selectedId;
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:${isSelected ? 18 : 14}px;height:${isSelected ? 18 : 14}px;
          background:${statusColor[m.status]};border:2px solid #fff;border-radius:50%;
          box-shadow:0 0 0 ${isSelected ? 3 : 1}px rgba(59,130,246,0.6);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([m.lat, m.lng], { icon })
        .bindPopup(
          `<strong>${m.plate}</strong><br/>${m.label}<br/>${m.speedKmh != null ? `${Math.round(m.speedKmh)} km/h` : "—"}`,
        )
        .addTo(layers.markers);

      marker.on("click", () => onSelect?.(m.id));
    }

    if (layers.route) {
      map.removeLayer(layers.route);
      layers.route = null;
    }

    if (route && route.length > 1) {
      const polyline = L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#3b82f6", weight: 4, opacity: 0.85 },
      ).addTo(map);
      layers.route = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], 14);
    } else if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers, route, geofences, selectedId, onSelect]);

  return <div ref={containerRef} className="fleet-map" style={{ height, width: "100%" }} />;
}
