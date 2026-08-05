"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export function MotoristaClient() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof api.getDriverRanking>>>([]);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof api.getChecklistTemplates>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);

  useEffect(() => {
    void Promise.all([
      api.getDriverRanking(),
      api.getChecklistTemplates(),
      api.getVehicles(),
    ]).then(([r, t, v]) => {
      setRanking(r);
      setTemplates(t);
      setVehicles(v);
    });
  }, []);

  const topScore = ranking[0]?.score ?? 100;

  return (
    <div className="driver-shell">
      <header className="driver-header">
        <div>
          <h1>Sulnet Motorista</h1>
          <p>{user?.name}</p>
        </div>
        <Link href="/" className="btn btn-secondary btn-sm">Painel gestor</Link>
      </header>

      <section className="driver-score-card">
        <h2>Seu score</h2>
        <div className="driver-score-value">{ranking.find((r) => r.name === user?.name)?.score ?? "—"}</div>
        <p className="muted">Melhor da frota: {topScore}</p>
      </section>

      <section className="driver-actions">
        <Link href="/checklist" className="driver-action-card">
          <strong>Checklist diário</strong>
          <span>{templates[0]?.name ?? "Conformidade do veículo"}</span>
        </Link>
        <Link href="/alertas" className="driver-action-card">
          <strong>Meus alertas</strong>
          <span>DMS e telemetria</span>
        </Link>
        <Link href="/relatorios" className="driver-action-card">
          <strong>Relatório pessoal</strong>
          <span>Hábitos de condução</span>
        </Link>
      </section>

      <section className="panel">
        <h3>Ranking da frota</h3>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Motorista</th><th>Score</th></tr>
          </thead>
          <tbody>
            {ranking.slice(0, 10).map((r, i) => (
              <tr key={r.driverId}>
                <td>{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Veículos da frota</h3>
        <p className="muted">{vehicles.length} veículos cadastrados</p>
      </section>
    </div>
  );
}
