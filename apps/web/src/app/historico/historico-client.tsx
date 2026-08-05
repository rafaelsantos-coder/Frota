"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
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
  const [playIndex, setPlayIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.getVehicles().then(setVehicles);
  }, []);

  useEffect(() => {
    if (searchParams.get("vehicleId")) {
      setVehicleId(searchParams.get("vehicleId")!);
    }
  }, [searchParams]);

  async function loadHistory() {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const data = await api.getPositionHistory(
        vehicleId,
        new Date(from).toISOString(),
        new Date(to).toISOString(),
      );
      setHistory(data);
      setPlayIndex(Math.max(0, data.length - 1));
    } finally {
      setLoading(false);
    }
  }

  const route = useMemo(
    () => history.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [history],
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

  return (
    <>
      <div className="page-header">
        <h2>Histórico de rota</h2>
        <p>Playback da trajetória no mapa</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Selecione…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} — {v.label}
              </option>
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

      <FleetMap markers={markers} route={route} height="420px" />

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
          </p>
        </div>
      )}
    </>
  );
}
