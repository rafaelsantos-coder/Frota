"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertStatusBadge, SeverityBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import type { AlertStatus } from "@frota/shared";

export function AlertasClient() {
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.getAlertsInbox>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  async function load() {
    const [inbox, v] = await Promise.all([
      api.getAlertsInbox({
        vehicleId: vehicleId || undefined,
        status: status || undefined,
        type: type || undefined,
      }),
      api.getVehicles(),
    ]);
    setAlerts(inbox);
    setVehicles(v);
  }

  useEffect(() => {
    void load();
  }, [vehicleId, status, type]);

  async function setAlertStatus(id: string, newStatus: AlertStatus) {
    await api.updateAlertStatus(id, newStatus);
    void load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Central de alertas</h2>
        <p>DMS, ADAS, velocidade e cercas — triagem operacional</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Todos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="NEW">Novo</option>
            <option value="REVIEWING">Em análise</option>
            <option value="RESOLVED">Resolvido</option>
          </select>
        </div>
        <div className="form-row">
          <label>Tipo</label>
          <input
            placeholder="SMOKING, OVERSPEED…"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
      </div>

      <div className="alert-inbox">
        {alerts.map((alert) => (
          <div key={alert.id} className="alert-inbox-item">
            <div className="alert-inbox-head">
              <div>
                <strong>{alert.label}</strong>
                <span className="muted">
                  {alert.vehicle?.plate ?? "—"} · {alert.source} ·{" "}
                  {new Date(alert.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="badge-row">
                <SeverityBadge severity={alert.severity} />
                <AlertStatusBadge status={alert.status} />
              </div>
            </div>
            <div className="alert-inbox-actions">
              {alert.status !== "REVIEWING" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void setAlertStatus(alert.id, "REVIEWING")}
                >
                  Analisar
                </button>
              )}
              {alert.status !== "RESOLVED" && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void setAlertStatus(alert.id, "RESOLVED")}
                >
                  Resolver
                </button>
              )}
              {alert.videoClips && alert.videoClips.length > 0 && (
                <Link href="/cameras" className="btn btn-secondary btn-sm">
                  Ver vídeo
                </Link>
              )}
              {alert.vehicleId && (
                <Link href={`/vehicles/${alert.vehicleId}`} className="btn btn-secondary btn-sm">
                  Veículo
                </Link>
              )}
            </div>
          </div>
        ))}
        {alerts.length === 0 && <p className="muted">Nenhum alerta encontrado.</p>}
      </div>
    </>
  );
}
