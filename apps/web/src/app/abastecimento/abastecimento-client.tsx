"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function AbastecimentoClient() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.getFuelEntries>>>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getFuelStats>> | null>(null);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [form, setForm] = useState({
    vehicleId: "",
    liters: "",
    amountPaid: "",
    odometerKm: "",
    station: "",
    recordedAt: new Date().toISOString().slice(0, 16),
  });

  async function load() {
    const [e, s, v] = await Promise.all([
      api.getFuelEntries(),
      api.getFuelStats(),
      api.getVehicles(),
    ]);
    setEntries(e);
    setStats(s);
    setVehicles(v);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.createFuelEntry({
      vehicleId: form.vehicleId,
      liters: Number(form.liters),
      amountPaid: Number(form.amountPaid),
      odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
      station: form.station || undefined,
      recordedAt: new Date(form.recordedAt).toISOString(),
    });
    setForm({ ...form, liters: "", amountPaid: "", odometerKm: "", station: "" });
    await load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Abastecimento</h2>
        <p>Controle de litros, custos e autonomia (Km/L)</p>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Litros (30 dias)</h3>
          <div className="value">{stats?.totalLiters.toFixed(1) ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Custo total</h3>
          <div className="value">R$ {stats?.totalCost.toFixed(2) ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Veículos abastecidos</h3>
          <div className="value">{stats?.byVehicle.length ?? "—"}</div>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Lançar abastecimento</h3>
          <form onSubmit={(e) => void handleSubmit(e)} className="form-stack">
            <div className="form-row">
              <label>Veículo</label>
              <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="">Selecione…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate} — {v.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Litros</label>
              <input type="number" step="0.01" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Valor pago (R$)</label>
              <input type="number" step="0.01" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Odômetro (km)</label>
              <input type="number" value={form.odometerKm} onChange={(e) => setForm({ ...form, odometerKm: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Posto</label>
              <input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Data</label>
              <input type="datetime-local" value={form.recordedAt} onChange={(e) => setForm({ ...form, recordedAt: e.target.value })} />
            </div>
            <button type="submit" className="btn">Registrar</button>
          </form>
        </section>

        <section className="panel">
          <h3>Por veículo (30 dias)</h3>
          <table className="table">
            <thead>
              <tr><th>Placa</th><th>Litros</th><th>Custo</th><th>Km/L est.</th></tr>
            </thead>
            <tbody>
              {stats?.byVehicle.map((v) => (
                <tr key={v.vehicleId}>
                  <td>{v.plate}</td>
                  <td>{v.liters}</td>
                  <td>R$ {v.cost.toFixed(2)}</td>
                  <td>{v.liters > 0 ? "—" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h3>Histórico</h3>
        <table className="table">
          <thead>
            <tr><th>Data</th><th>Veículo</th><th>Litros</th><th>Valor</th><th>Posto</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.recordedAt).toLocaleString("pt-BR")}</td>
                <td>{e.vehicle?.plate}</td>
                <td>{e.liters}</td>
                <td>R$ {e.amountPaid.toFixed(2)}</td>
                <td>{e.station ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
