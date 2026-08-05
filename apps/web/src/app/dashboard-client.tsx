"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_DASHBOARD_WIDGETS } from "@frota/shared";

export function DashboardClient() {
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof api.getDashboardKpis>> | null>(null);
  const [widgets, setWidgets] = useState(DEFAULT_DASHBOARD_WIDGETS);
  const [positions, setPositions] = useState<Awaited<ReturnType<typeof api.getLatestPositions>>>([]);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof api.getAlerts>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [kpiData, layout, positionsData, alertsData] = await Promise.all([
          api.getDashboardKpis(),
          api.getDashboardLayout(),
          api.getLatestPositions(),
          api.getAlerts(),
        ]);
        setKpis(kpiData);
        setWidgets(layout);
        setPositions(positionsData);
        setAlerts(alertsData.slice(0, 6));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      }
    })();
  }, []);

  const visible = widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);

  function toggleWidget(id: string) {
    const next = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    setWidgets(next);
    void api.saveDashboardLayout(next);
  }

  const widgetCards: Record<string, { title: string; value: string | number; hint?: string }> = {
    vehicles: { title: "Veículos", value: kpis?.vehicles ?? "—" },
    online: { title: "Rastreadores online", value: kpis?.onlineTrackers ?? "—" },
    alerts: { title: "Alertas críticos", value: kpis?.criticalAlerts ?? "—" },
    distance: { title: "Km (7 dias)", value: kpis?.distanceKm7d ?? "—" },
    score: { title: "Score médio", value: kpis?.avgScore ?? "—" },
    fuel: { title: "Combustível (mês)", value: kpis ? `R$ ${kpis.fuelCostMonth}` : "—" },
    maintenance: { title: "Manutenções vencendo", value: kpis?.maintenanceDue ?? "—" },
    fines: { title: "Multas pendentes", value: kpis?.pendingFines ?? "—" },
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Visão operacional — Sulnet Gestão de Frota</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setEditMode(!editMode)}>
          {editMode ? "Concluir" : "Personalizar widgets"}
        </button>
      </div>

      {error && <div className="panel">{error}</div>}

      {editMode && (
        <div className="panel widget-editor">
          <h3>Widgets visíveis</h3>
          <div className="widget-toggles">
            {widgets.map((w) => (
              <label key={w.id}>
                <input type="checkbox" checked={w.visible} onChange={() => toggleWidget(w.id)} />
                {widgetCards[w.type]?.title ?? w.type}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="quick-links">
        <Link href="/monitoramento" className="quick-link-card">
          <strong>Monitoramento</strong>
          <span>Mapa ao vivo da frota</span>
        </Link>
        <Link href="/motoristas" className="quick-link-card">
          <strong>Motoristas</strong>
          <span>RFID e ranking</span>
        </Link>
        <Link href="/abastecimento" className="quick-link-card">
          <strong>Abastecimento</strong>
          <span>Custo e Km/L</span>
        </Link>
        <Link href="/manutencao" className="quick-link-card">
          <strong>Manutenção</strong>
          <span>Preventiva e corretiva</span>
        </Link>
      </div>

      <div className="grid-cards">
        {visible.map((w) => {
          const card = widgetCards[w.type];
          if (!card) return null;
          return (
            <div key={w.id} className="card">
              <h3>{card.title}</h3>
              <div className="value">{card.value}</div>
              {card.hint && <span className="muted">{card.hint}</span>}
            </div>
          );
        })}
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
