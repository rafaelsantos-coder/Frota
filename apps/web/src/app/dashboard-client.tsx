"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function DashboardClient() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.getIntegrationStatus>> | null>(
    null,
  );
  const [positions, setPositions] = useState<
    Awaited<ReturnType<typeof api.getLatestPositions>>
  >([]);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.getAlerts>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [statusData, positionsData, alertsData] = await Promise.all([
          api.getIntegrationStatus(),
          api.getLatestPositions(),
          api.getAlerts(),
        ]);
        setStatus(statusData);
        setPositions(positionsData);
        setAlerts(alertsData.slice(0, 8));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      }
    })();
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Visão operacional — Sulnet Gestão de Frota</p>
      </div>

      {error && <div className="panel">{error}</div>}

      <div className="grid-cards">
        <div className="card">
          <h3>Veículos cadastrados</h3>
          <div className="value">{status?.vehicles ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Rastreadores online</h3>
          <div className="value">{status?.gt06.activeSessions ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Jimi configurado</h3>
          <div className="value">{status?.jimi.configured ? "Sim" : "Não"}</div>
        </div>
        <div className="card">
          <h3>Alertas recentes</h3>
          <div className="value">{alerts.length}</div>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Últimas posições</h3>
          {positions.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nenhuma posição recebida ainda.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Fonte</th>
                  <th>Coordenadas</th>
                  <th>Velocidade</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((item) => (
                  <tr key={item.vehicle.id}>
                    <td>{item.vehicle.plate}</td>
                    <td>{item.position.source}</td>
                    <td>
                      {item.position.latitude.toFixed(5)}, {item.position.longitude.toFixed(5)}
                    </td>
                    <td>{item.position.speedKmh ?? "—"} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>Alertas DMS / tracker</h3>
          <div className="alert-list">
            {alerts.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Nenhum alerta registrado.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="alert-item">
                  <strong>{alert.label}</strong>
                  <span>
                    {alert.source} · {new Date(alert.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
