"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function RelatoriosClient() {
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.getFleetReport>> | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getFleetReport(
        new Date(from).toISOString(),
        new Date(`${to}T23:59:59`).toISOString(),
      );
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Relatórios e TCO</h2>
        <p>Quilometragem, score, custo por km e ranking de motoristas</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? "Gerando…" : "Gerar relatório"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            void api.exportFleetReport("csv", new Date(from).toISOString(), new Date(`${to}T23:59:59`).toISOString())
          }
        >
          Exportar CSV
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void api.exportFleetReport("pdf")}>
          Exportar PDF
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void api.exportAlerts("csv")}>
          Alertas CSV
        </button>
      </div>

      {report && (
        <>
          <div className="grid-cards">
            <div className="card">
              <h3>Km total</h3>
              <div className="value">{report.totals.distanceKm}</div>
            </div>
            <div className="card">
              <h3>Custo total</h3>
              <div className="value">R$ {report.totals.totalCost}</div>
            </div>
            <div className="card">
              <h3>Custo / km (TCO)</h3>
              <div className="value">R$ {report.totals.costPerKm}</div>
            </div>
            <div className="card">
              <h3>Score médio</h3>
              <div className="value">{report.totals.avgScore}</div>
            </div>
          </div>

          <div className="panel">
            <h3>Ranking por veículo</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Km</th>
                  <th>Ociosidade</th>
                  <th>Combustível</th>
                  <th>Manutenção</th>
                  <th>Custo/km</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {[...report.vehicles]
                  .sort((a, b) => b.score - a.score)
                  .map((row) => (
                    <tr key={row.vehicleId}>
                      <td>
                        <Link href={`/vehicles/${row.vehicleId}`}>{row.plate} — {row.label}</Link>
                      </td>
                      <td>{row.distanceKm}</td>
                      <td>{row.idleMinutes ?? 0} min</td>
                      <td>R$ {row.fuelCost}</td>
                      <td>R$ {row.maintenanceCost}</td>
                      <td>R$ {row.costPerKm}</td>
                      <td>
                        <span className={`score score-${row.score >= 80 ? "good" : row.score >= 50 ? "mid" : "bad"}`}>
                          {row.score}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {report.drivers.length > 0 && (
            <div className="panel">
              <h3>Ranking por motorista</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Motorista</th>
                    <th>Km</th>
                    <th>Alertas DMS</th>
                    <th>Excessos</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.drivers.map((d) => (
                    <tr key={d.driverId}>
                      <td>{d.name}</td>
                      <td>{d.distanceKm}</td>
                      <td>{d.dmsAlertCount}</td>
                      <td>{d.speedViolationCount}</td>
                      <td>
                        <span className={`score score-${d.score >= 80 ? "good" : d.score >= 50 ? "mid" : "bad"}`}>
                          {d.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
