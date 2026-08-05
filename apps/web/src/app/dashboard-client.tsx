"use client";

import Link from "next/link";
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
        setAlerts(alertsData.slice(0, 6));
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

      <div className="quick-links">
        <Link href="/monitoramento" className="quick-link-card">
          <strong>Monitoramento</strong>
          <span>Mapa ao vivo da frota</span>
        </Link>
        <Link href="/alertas" className="quick-link-card">
          <strong>Alertas</strong>
          <span>DMS, velocidade, cercas</span>
        </Link>
        <Link href="/cameras" className="quick-link-card">
          <strong>Câmeras</strong>
          <span>Clipes JC371</span>
        </Link>
        <Link href="/relatorios" className="quick-link-card">
          <strong>Relatórios</strong>
          <span>Score e km rodado</span>
        </Link>
      </div>

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
                  <th>Velocidade</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((item) => (
                  <tr key={item.vehicle.id}>
                    <td>{item.vehicle.plate}</td>
                    <td>{item.position.source}</td>
                    <td>{item.position.speedKmh ?? "—"} km/h</td>
                    <td>
                      <Link href={`/vehicles/${item.vehicle.id}`}>Perfil</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>Alertas recentes</h3>
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
          <Link href="/alertas" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
            Ver todos
          </Link>
        </section>
      </div>
    </>
  );
}
