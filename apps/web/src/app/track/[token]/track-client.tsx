"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false, loading: () => <div className="map-loading">Carregando mapa…</div> },
);

export function PublicTrackClient({ token }: { token: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getPublicTrack>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setData(await api.getPublicTrack(token));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link inválido");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [token]);

  if (error) {
    return (
      <div className="public-track">
        <div className="panel error-panel">{error}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="map-loading">Carregando rastreamento…</div>;
  }

  const markers =
    data.latitude != null && data.longitude != null
      ? [
          {
            id: "vehicle",
            lat: data.latitude,
            lng: data.longitude,
            label: data.label,
            plate: data.plate,
            status: data.commStatus,
            speedKmh: data.speedKmh,
          },
        ]
      : [];

  return (
    <div className="public-track">
      <header className="public-track-header">
        <h1>Sulnet — Rastreamento</h1>
        <div>
          <strong>{data.plate}</strong> · {data.label}
          {data.speedKmh != null && <span> · {Math.round(data.speedKmh)} km/h</span>}
        </div>
        <p className="muted">
          Válido até {new Date(data.expiresAt).toLocaleString("pt-BR")}
          {data.recordedAt && ` · Atualizado ${new Date(data.recordedAt).toLocaleString("pt-BR")}`}
        </p>
      </header>
      <FleetMap markers={markers} height="calc(100vh - 140px)" fitRoute={false} />
    </div>
  );
}
