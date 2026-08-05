"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";

const FleetMap = dynamic(
  () => import("@/components/fleet-map").then((m) => m.FleetMap),
  { ssr: false },
);

export function VehicleDetailClient() {
  const params = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Awaited<ReturnType<typeof api.getVehicle>> | null>(null);
  const [position, setPosition] = useState<
    Awaited<ReturnType<typeof api.getLivePositions>>[number]["position"]
  >(null);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.getAlertsInbox>>>([]);

  useEffect(() => {
    void (async () => {
      const [v, live, inbox] = await Promise.all([
        api.getVehicle(params.id),
        api.getLivePositions(),
        api.getAlertsInbox({ vehicleId: params.id, limit: "10" }),
      ]);
      setVehicle(v);
      setPosition(live.find((l) => l.vehicle.id === params.id)?.position ?? null);
      setAlerts(inbox.slice(0, 8));
    })();
  }, [params.id]);

  if (!vehicle) return <p className="muted">Carregando…</p>;

  const markers = position
    ? [
        {
          id: vehicle.id,
          lat: position.latitude,
          lng: position.longitude,
          label: vehicle.label,
          plate: vehicle.plate,
          status: vehicle.trackerStatus,
          speedKmh: position.speedKmh,
        },
      ]
    : [];

  return (
    <>
      <div className="page-header">
        <h2>
          {vehicle.plate} — {vehicle.label}
        </h2>
        <p>Perfil do veículo</p>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Rastreador</h3>
          <StatusBadge status={vehicle.trackerStatus} />
          <p className="muted">{vehicle.trackerImei ?? "—"}</p>
        </div>
        <div className="card">
          <h3>Câmera JC371</h3>
          <StatusBadge status={vehicle.cameraStatus} />
          <p className="muted">{vehicle.cameraDeviceId ?? "—"}</p>
        </div>
        <div className="card">
          <h3>Velocidade</h3>
          <div className="value">
            {position?.speedKmh != null ? `${Math.round(position.speedKmh)} km/h` : "—"}
          </div>
        </div>
      </div>

      <div className="detail-actions" style={{ marginBottom: 16 }}>
        <Link href={`/monitoramento`} className="btn">
          Ver no mapa
        </Link>
        <Link href={`/historico?vehicleId=${vehicle.id}`} className="btn btn-secondary">
          Histórico
        </Link>
        <Link href={`/cameras?vehicleId=${vehicle.id}`} className="btn btn-secondary">
          Câmeras
        </Link>
        <Link href={`/alertas?vehicleId=${vehicle.id}`} className="btn btn-secondary">
          Alertas
        </Link>
      </div>

      <FleetMap markers={markers} height="320px" />

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Alertas recentes</h3>
        <div className="alert-list">
          {alerts.map((a) => (
            <div key={a.id} className="alert-item">
              <strong>{a.label}</strong>
              <span>{new Date(a.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          ))}
          {alerts.length === 0 && <p className="muted">Nenhum alerta.</p>}
        </div>
      </div>
    </>
  );
}
