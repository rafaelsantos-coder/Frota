"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapGeofence, MapMarker } from "@/components/fleet-map";
import { MapLayerControls } from "@/components/map-layer-controls";
import { StatusBadge } from "@/components/status-badge";
import { DEFAULT_MAP_LAYERS } from "@frota/shared";
import type { MapLayerOptions, VehicleLiveStatusDto } from "@frota/shared";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false, loading: () => <div className="map-loading">Carregando mapa…</div> },
);

function statusLabel(status: VehicleLiveStatusDto) {
  return {
    gps: status.gpsStatus === "OK" ? "GPS OK" : status.gpsStatus === "NO_SIGNAL" ? "Sem GPS" : "—",
    comm: status.commStatus === "ONLINE" ? "Online" : status.commStatus === "OFFLINE" ? "Offline" : "—",
    motion:
      status.motionStatus === "MOVING"
        ? "Em movimento"
        : status.motionStatus === "STOPPED"
          ? "Parado"
          : "—",
  };
}

export function MonitoramentoClient() {
  const [live, setLive] = useState<Awaited<ReturnType<typeof api.getLivePositions>>>([]);
  const [geofences, setGeofences] = useState<MapGeofence[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayerOptions>(DEFAULT_MAP_LAYERS);
  const [trail, setTrail] = useState<Array<{ lat: number; lng: number }>>([]);
  const [liveStatus, setLiveStatus] = useState<VehicleLiveStatusDto | null>(null);
  const [addresses, setAddresses] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!selectedId) {
      setTrail([]);
      setLiveStatus(null);
      return;
    }
    void (async () => {
      const [trailData, status] = await Promise.all([
        api.getPositionTrail(selectedId, 80),
        api.getVehicleLiveStatus(selectedId),
      ]);
      setTrail(trailData.map((p) => ({ lat: p.latitude, lng: p.longitude })));
      setLiveStatus(status);
      if (layers.showAddress && status.address) {
        setAddresses((prev) => ({ ...prev, [selectedId]: status.address! }));
      }
    })();
  }, [selectedId, layers.showAddress]);

  useEffect(() => {
    if (!layers.showAddress || live.length === 0) return;
    void (async () => {
      const withPos = live.filter((l) => l.position);
      for (const item of withPos.slice(0, 8)) {
        if (addresses[item.vehicle.id]) continue;
        try {
          const { address } = await api.reverseGeocode(
            item.position!.latitude,
            item.position!.longitude,
          );
          if (address) {
            setAddresses((prev) => ({ ...prev, [item.vehicle.id]: address }));
          }
        } catch {
          /* ignore geocode errors */
        }
      }
    })();
  }, [layers.showAddress, live, addresses]);

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
      address: addresses[item.vehicle.id] ?? null,
    }));

  const selected = live.find((l) => l.vehicle.id === selectedId);
  const labels = liveStatus ? statusLabel(liveStatus) : null;

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
        <MapLayerControls layers={layers} onChange={setLayers} />
        {error && <div className="panel error-panel">{error}</div>}
        <FleetMap
          markers={markers}
          trail={selectedId ? trail : undefined}
          geofences={geofences}
          layers={layers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          height="calc(100vh - 200px)"
          fitRoute={false}
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
          {filtered.length === 0 && <p className="muted">Nenhum veículo encontrado.</p>}
        </div>

        {selected && liveStatus && labels && (
          <div className="panel vehicle-status-panel">
            <h3>Status — {selected.vehicle.plate}</h3>
            <div className="status-grid">
              <div>
                <span className="muted">GPS</span>
                <strong>{labels.gps}</strong>
              </div>
              <div>
                <span className="muted">Comunicação</span>
                <strong>{labels.comm}</strong>
              </div>
              <div>
                <span className="muted">Movimento</span>
                <strong>{labels.motion}</strong>
              </div>
              <div>
                <span className="muted">Ignição</span>
                <strong>{liveStatus.ignitionOn == null ? "—" : liveStatus.ignitionOn ? "Ligada" : "Desligada"}</strong>
              </div>
              <div>
                <span className="muted">Velocidade</span>
                <strong>{liveStatus.speedKmh != null ? `${Math.round(liveStatus.speedKmh)} km/h` : "—"}</strong>
              </div>
              <div>
                <span className="muted">Última posição</span>
                <strong>
                  {liveStatus.lastPositionAt
                    ? new Date(liveStatus.lastPositionAt).toLocaleString("pt-BR")
                    : "—"}
                </strong>
              </div>
            </div>
            {liveStatus.address && (
              <p className="muted address-line">{liveStatus.address}</p>
            )}
          </div>
        )}

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
