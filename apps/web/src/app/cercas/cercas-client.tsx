"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false, loading: () => <div className="map-loading">Carregando mapa…</div> },
);

export function CercasClient() {
  const [fences, setFences] = useState<Awaited<ReturnType<typeof api.getGeofences>>>([]);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("-23.5505");
  const [lng, setLng] = useState("-46.6333");
  const [radius, setRadius] = useState("500");

  async function load() {
    setFences(await api.getGeofences());
  }

  useEffect(() => {
    void load();
  }, []);

  async function createFence(e: React.FormEvent) {
    e.preventDefault();
    await api.createGeofence({
      name,
      latitude: Number(lat),
      longitude: Number(lng),
      radiusMeters: Number(radius),
    });
    setName("");
    void load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Cercas eletrônicas</h2>
        <p>Defina áreas e receba alertas de entrada/saída no mapa de monitoramento</p>
      </div>

      <div className="two-col">
        <form className="panel form-grid" onSubmit={(e) => void createFence(e)}>
          <h3>Nova cerca</h3>
          <div className="form-row">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Raio (metros)</label>
            <input value={radius} onChange={(e) => setRadius(e.target.value)} required />
          </div>
          <button type="submit" className="btn">
            Criar cerca
          </button>
        </form>

        <div className="panel">
          <h3>Cercas cadastradas ({fences.length})</h3>
          <div className="fence-list">
            {fences.map((f) => (
              <div key={f.id} className="fence-item">
                <strong>{f.name}</strong>
                <span className="muted">
                  {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)} · {f.radiusMeters}m
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void api.deleteGeofence(f.id).then(load)}
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FleetMap
        height="360px"
        markers={[]}
        geofences={fences.map((f) => ({
          id: f.id,
          lat: f.latitude,
          lng: f.longitude,
          radiusMeters: f.radiusMeters,
          name: f.name,
        }))}
      />
    </>
  );
}
