"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { MapLayerControls } from "@/components/map-layer-controls";
import { TimelineBar } from "@/components/timeline-bar";
import { DEFAULT_MAP_LAYERS } from "@frota/shared";
import type { MapLayerOptions, TimelineReportDto } from "@frota/shared";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false, loading: () => <div className="map-loading">Carregando mapa…</div> },
);

export function HistoricoClient() {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [vehicleId, setVehicleId] = useState(searchParams.get("vehicleId") ?? "");
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getPositionHistory>>>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof api.getRouteEvents>>>([]);
  const [stops, setStops] = useState<Awaited<ReturnType<typeof api.getStopPoints>>>([]);
  const [timeline, setTimeline] = useState<TimelineReportDto | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<MapLayerOptions>(DEFAULT_MAP_LAYERS);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureKm, setMeasureKm] = useState<number | null>(null);

  useEffect(() => {
    void api.getVehicles().then(setVehicles);
  }, []);

  useEffect(() => {
    if (searchParams.get("vehicleId")) setVehicleId(searchParams.get("vehicleId")!);
  }, [searchParams]);

  async function loadHistory() {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to).toISOString();
      const [data, ev, st, tl] = await Promise.all([
        api.getPositionHistory(vehicleId, fromIso, toIso),
        api.getRouteEvents(vehicleId, fromIso, toIso),
        api.getStopPoints(vehicleId, fromIso, toIso),
        api.getTimeline(vehicleId, fromIso, toIso),
      ]);
      setHistory(data);
      setEvents(ev);
      setStops(st);
      setTimeline(tl);
      setPlayIndex(Math.max(0, data.length - 1));
    } finally {
      setLoading(false);
    }
  }

  const route = useMemo(
    () => history.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [history],
  );

  const eventMarkers = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        lat: e.latitude,
        lng: e.longitude,
        label: e.label,
        type: e.type,
      })),
    [events],
  );

  const current = history[playIndex];
  const markers = current
    ? [
        {
          id: vehicleId,
          lat: current.latitude,
          lng: current.longitude,
          label: vehicles.find((v) => v.id === vehicleId)?.label ?? "",
          plate: vehicles.find((v) => v.id === vehicleId)?.plate ?? "",
          status: "ONLINE" as const,
          speedKmh: current.speedKmh,
        },
      ]
    : [];

  const googleMapsUrl = current
    ? `https://www.google.com/maps?q=${current.latitude},${current.longitude}`
    : null;

  return (
    <>
      <div className="page-header">
        <h2>Histórico de rota</h2>
        <p>Linha do tempo, eventos, paradas e medir distância</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Selecione…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plate} — {v.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>De</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Até</label>
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={() => void loadHistory()} disabled={loading}>
          {loading ? "Carregando…" : "Carregar rota"}
        </button>
      </div>

      <MapLayerControls
        layers={layers}
        onChange={setLayers}
        extra={
          <label>
            <input
              type="checkbox"
              checked={measureMode}
              onChange={(e) => {
                setMeasureMode(e.target.checked);
                if (!e.target.checked) setMeasureKm(null);
              }}
            />
            Medir distância
            {measureKm != null && <strong> ({measureKm} km)</strong>}
          </label>
        }
      />

      {timeline && (
        <section className="panel">
          <h3>Linha do tempo</h3>
          <TimelineBar timeline={timeline} />
        </section>
      )}

      <FleetMap
        markers={markers}
        route={route}
        eventMarkers={eventMarkers}
        layers={layers}
        measureMode={measureMode}
        onMeasureChange={setMeasureKm}
        height="420px"
      />

      {history.length > 0 && (
        <div className="panel playback-controls">
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={playIndex}
            onChange={(e) => setPlayIndex(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <p className="muted">
            {playIndex + 1} / {history.length} —{" "}
            {current ? new Date(current.recordedAt).toLocaleString("pt-BR") : ""} —{" "}
            {current?.speedKmh != null ? `${Math.round(current.speedKmh)} km/h` : "—"}
            {googleMapsUrl && (
              <>
                {" · "}
                <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                  Abrir no Google Maps
                </a>
              </>
            )}
          </p>
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <h3>Eventos na rota ({events.length})</h3>
          <div className="alert-list">
            {events.slice(0, 20).map((e) => (
              <div key={e.id} className="alert-item">
                <strong>{e.label}</strong>
                <span>{new Date(e.recordedAt).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {events.length === 0 && <p className="muted">Nenhum evento no período</p>}
          </div>
        </section>
        <section className="panel">
          <h3>Paradas ({stops.length})</h3>
          <table className="table">
            <thead>
              <tr><th>Início</th><th>Duração</th></tr>
            </thead>
            <tbody>
              {stops.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.startedAt).toLocaleString("pt-BR")}</td>
                  <td>{s.durationMin} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
