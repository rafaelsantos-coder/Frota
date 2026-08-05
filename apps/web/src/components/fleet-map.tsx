"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapLayerOptions } from "@frota/shared";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  plate: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  speedKmh?: number | null;
  address?: string | null;
};

export type MapGeofence = {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  name: string;
};

export type MapEventMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: string;
};

type FleetMapProps = {
  markers: MapMarker[];
  route?: Array<{ lat: number; lng: number }>;
  trail?: Array<{ lat: number; lng: number }>;
  geofences?: MapGeofence[];
  eventMarkers?: MapEventMarker[];
  layers?: MapLayerOptions;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: string;
  zoom?: number;
  measureMode?: boolean;
  onMeasureChange?: (distanceKm: number | null) => void;
  fitRoute?: boolean;
};

const statusColor: Record<MapMarker["status"], string> = {
  ONLINE: "#22c55e",
  OFFLINE: "#94a3b8",
  UNKNOWN: "#f59e0b",
};

function haversineKm(a: L.LatLng, b: L.LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function FleetMap({
  markers,
  route,
  trail,
  geofences = [],
  eventMarkers = [],
  layers,
  selectedId,
  onSelect,
  height = "100%",
  zoom = 12,
  measureMode = false,
  onMeasureChange,
  fitRoute = true,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    markers: L.LayerGroup;
    routes: L.LayerGroup;
    geofences: L.LayerGroup;
    measure: L.LayerGroup;
  } | null>(null);
  const measurePointsRef = useRef<L.LatLng[]>([]);
  const [measureKm, setMeasureKm] = useState<number | null>(null);

  const showTrail = layers?.showTrail !== false;
  const connectPoints = layers?.connectPoints !== false;
  const showGeofences = layers?.showGeofences !== false;
  const showAddress = layers?.showAddress === true;

  const clearMeasure = useCallback(() => {
    measurePointsRef.current = [];
    setMeasureKm(null);
    onMeasureChange?.(null);
    layersRef.current?.measure.clearLayers();
  }, [onMeasureChange]);

  useEffect(() => {
    if (!measureMode) clearMeasure();
  }, [measureMode, clearMeasure]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([-23.5505, -46.6333], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const geofenceLayer = L.layerGroup().addTo(map);
    const measureLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    layersRef.current = {
      markers: markerLayer,
      routes: routeLayer,
      geofences: geofenceLayer,
      measure: measureLayer,
    };

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      if (!measureMode) return;
      const pts = [...measurePointsRef.current, e.latlng];
      measurePointsRef.current = pts;

      const measureLayer = layersRef.current?.measure;
      if (!measureLayer) return;
      measureLayer.clearLayers();

      for (const p of pts) {
        L.circleMarker(p, { radius: 5, color: "#2563eb", fillColor: "#2563eb", fillOpacity: 1 }).addTo(
          measureLayer,
        );
      }

      if (pts.length > 1) {
        L.polyline(pts, { color: "#2563eb", weight: 3, dashArray: "6 4" }).addTo(measureLayer);
        let dist = 0;
        for (let i = 1; i < pts.length; i++) {
          dist += haversineKm(pts[i - 1]!, pts[i]!);
        }
        const rounded = Math.round(dist * 100) / 100;
        setMeasureKm(rounded);
        onMeasureChange?.(rounded);
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [measureMode, onMeasureChange]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroups = layersRef.current;
    if (!map || !layerGroups) return;

    layerGroups.markers.clearLayers();
    layerGroups.geofences.clearLayers();
    layerGroups.routes.clearLayers();

    if (showGeofences) {
      for (const fence of geofences) {
        L.circle([fence.lat, fence.lng], {
          radius: fence.radiusMeters,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 2,
        })
          .bindTooltip(fence.name)
          .addTo(layerGroups.geofences);
      }
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

      const popupLines = [
        `<strong>${m.plate}</strong>`,
        m.label,
        m.speedKmh != null ? `${Math.round(m.speedKmh)} km/h` : null,
        showAddress && m.address ? `<small>${m.address}</small>` : null,
        `<a href="https://www.google.com/maps?q=${m.lat},${m.lng}" target="_blank" rel="noreferrer">Google Maps</a>`,
      ]
        .filter(Boolean)
        .join("<br/>");

      const marker = L.marker([m.lat, m.lng], { icon }).bindPopup(popupLines).addTo(layerGroups.markers);
      marker.on("click", () => onSelect?.(m.id));
    }

    for (const e of eventMarkers) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;background:#ef4444;border:2px solid #fff;border-radius:2px;transform:rotate(45deg);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      L.marker([e.lat, e.lng], { icon })
        .bindPopup(`<strong>${e.label}</strong><br/><small>${e.type}</small>`)
        .addTo(layerGroups.markers);
    }

    const drawRoute = (points: Array<{ lat: number; lng: number }>, color: string, weight: number, opacity: number, dash?: string) => {
      if (points.length > 1 && connectPoints) {
        L.polyline(
          points.map((p) => [p.lat, p.lng] as [number, number]),
          { color, weight, opacity, dashArray: dash },
        ).addTo(layerGroups.routes);
      }
    };

    if (trail && showTrail) {
      drawRoute(trail, "#64748b", 3, 0.6, "4 6");
    }

    if (route && route.length > 1) {
      drawRoute(route, "#3b82f6", 4, 0.85);
      if (fitRoute) {
        const bounds = L.latLngBounds(route.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } else if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], 14);
    } else if (markers.length > 1 && fitRoute) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [
    markers,
    route,
    trail,
    geofences,
    eventMarkers,
    selectedId,
    onSelect,
    showTrail,
    connectPoints,
    showGeofences,
    showAddress,
    fitRoute,
  ]);

  return (
    <div className="fleet-map-wrap">
      {measureMode && (
        <div className="measure-banner">
          Clique no mapa para medir distância
          {measureKm != null && <strong> — {measureKm} km</strong>}
          <button type="button" className="btn btn-sm" onClick={clearMeasure}>
            Limpar
          </button>
        </div>
      )}
      <div ref={containerRef} className="fleet-map" style={{ height, width: "100%" }} />
    </div>
  );
}
