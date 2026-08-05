"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapGeofence, MapMarker } from "@/components/fleet-map";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false, loading: () => <div className="map-loading">Carregando mapa…</div> },
);

export function MonitoramentoClient() {
  const [live, setLive] = useState<Awaited<ReturnType<typeof api.getLivePositions>>>([]);
  const [geofences, setGeofences] = useState<MapGeofence[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [positions, fences] = await Promise.all([
        api.getLivePositions(),
        api.getGeofences(),
      ]);
      setLive(positions);
      setGeofences(
        fences.filter((f) => f.enabled).map((f) => ({
          id: f.id,
          lat: f.latitude,
          lng: f.longitude,
          radiusMeters: f.radiusMeters,
          name: f.name,
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return live;
    return live.filter(
      (item) =>
        item.vehicle.plate.toLowerCase().includes(q) ||
        item.vehicle.label.toLowerCase().includes(q),
    );
  }, [live, search]);

  const markers: MapMarker[] = filtered
    .filter((item) => item.position)
    .map((item) => ({
      id: item.vehicle.id,
      lat: item.position!.latitude,
      lng: item.position!.longitude,
      label: item.vehicle.label,
      plate: item.vehicle.plate,
      status: item.vehicle.trackerStatus,
      speedKmh: item.position!.speedKmh,
    }));

  const selected = live.find((l) => l.vehicle.id === selectedId);

  return (
    <div className="monitor-layout">
      <div className="monitor-map">
        <div className="page-header compact">
          <div>
            <h2>Monitoramento</h2>
            <p>Mapa ao vivo — atualiza a cada 10s</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Atualizar
          </button>
        </div>
        {error && <div className="panel error-panel">{error}</div>}
        <FleetMap
          markers={markers}
          geofences={geofences}
          selectedId={selectedId}
          onSelect={setSelectedId}
          height="calc(100vh - 140px)"
        />
      </div>

      <aside className="monitor-sidebar">
        <input
          className="search-input"
          placeholder="Buscar placa ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="vehicle-list">
          {filtered.map((item) => (
            <button
              key={item.vehicle.id}
              type="button"
              className={`vehicle-list-item${selectedId === item.vehicle.id ? " selected" : ""}`}
              onClick={() => setSelectedId(item.vehicle.id)}
            >
              <div className="vehicle-list-top">
                <strong>{item.vehicle.plate}</strong>
                <StatusBadge status={item.vehicle.trackerStatus} />
              </div>
              <span>{item.vehicle.label}</span>
              <span className="muted">
                {item.position
                  ? `${item.position.speedKmh != null ? `${Math.round(item.position.speedKmh)} km/h · ` : ""}${new Date(item.position.recordedAt).toLocaleString("pt-BR")}`
                  : "Sem posição"}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="muted">Nenhum veículo encontrado.</p>
          )}
        </div>

        {selected && (
          <div className="panel vehicle-detail-panel">
            <h3>{selected.vehicle.plate}</h3>
            <p>{selected.vehicle.label}</p>
            <div className="detail-actions">
              <Link href={`/vehicles/${selected.vehicle.id}`} className="btn btn-secondary">
                Perfil
              </Link>
              <Link
                href={`/historico?vehicleId=${selected.vehicle.id}`}
                className="btn btn-secondary"
              >
                Histórico
              </Link>
              <Link href={`/cameras?vehicleId=${selected.vehicle.id}`} className="btn">
                Câmera
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
