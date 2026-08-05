"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function MotoristasClient() {
  const [drivers, setDrivers] = useState<Awaited<ReturnType<typeof api.getDrivers>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof api.getDriverRanking>>>([]);
  const [form, setForm] = useState({ name: "", cpf: "", cnh: "", rfidTag: "" });
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});

  async function load() {
    const [d, v, r] = await Promise.all([
      api.getDrivers(),
      api.getVehicles(),
      api.getDriverRanking(),
    ]);
    setDrivers(d);
    setVehicles(v);
    setRanking(r);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.createDriver({
      name: form.name,
      cpf: form.cpf || undefined,
      cnh: form.cnh || undefined,
      rfidTag: form.rfidTag || undefined,
    });
    setForm({ name: "", cpf: "", cnh: "", rfidTag: "" });
    await load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Motoristas</h2>
        <p>Cadastro, RFID/iButton e ranking de condução</p>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Novo motorista</h3>
          <form onSubmit={(e) => void handleCreate(e)} className="form-stack">
            <div className="form-row">
              <label>Nome</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>CPF</label>
              <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="form-row">
              <label>CNH</label>
              <input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} />
            </div>
            <div className="form-row">
              <label>RFID / iButton</label>
              <input value={form.rfidTag} onChange={(e) => setForm({ ...form, rfidTag: e.target.value })} />
            </div>
            <button type="submit" className="btn">Cadastrar</button>
          </form>
        </section>

        <section className="panel">
          <h3>Ranking (30 dias)</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Score</th>
                <th>DMS</th>
                <th>Excessos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.driverId}>
                  <td>{r.name}</td>
                  <td>
                    <span className={`score score-${r.score >= 80 ? "good" : r.score >= 50 ? "mid" : "bad"}`}>
                      {r.score}
                    </span>
                  </td>
                  <td>{r.dmsAlertCount}</td>
                  <td>{r.speedViolationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h3>Motoristas cadastrados ({drivers.length})</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>RFID</th>
              <th>Veículo atual</th>
              <th>Vincular</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.cpf ?? "—"}</td>
                <td>{d.rfidTag ?? "—"}</td>
                <td>{d.currentVehicle ? `${d.currentVehicle.plate}` : "—"}</td>
                <td>
                  <select
                    value={assignMap[d.id] ?? ""}
                    onChange={(e) => setAssignMap({ ...assignMap, [d.id]: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.plate}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!assignMap[d.id]}
                    onClick={() =>
                      void api.assignDriver(d.id, assignMap[d.id]!).then(load)
                    }
                  >
                    Vincular
                  </button>
                </td>
                <td>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void api.deleteDriver(d.id).then(load)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
