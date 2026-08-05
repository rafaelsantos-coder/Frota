"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function MultasClient() {
  const [fines, setFines] = useState<Awaited<ReturnType<typeof api.getFines>>>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof api.getExpenses>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [fineForm, setFineForm] = useState({ vehicleId: "", description: "", amount: "", location: "" });
  const [expenseForm, setExpenseForm] = useState({
    vehicleId: "",
    category: "IPVA" as const,
    description: "",
    amount: "",
  });

  async function load() {
    const [f, e, v] = await Promise.all([api.getFines(), api.getExpenses(), api.getVehicles()]);
    setFines(f);
    setExpenses(e);
    setVehicles(v);
  }

  useEffect(() => {
    void load();
  }, []);

  const pendingTotal = fines.filter((f) => f.status === "PENDING").reduce((s, f) => s + f.amount, 0);

  return (
    <>
      <div className="page-header">
        <h2>Multas e despesas</h2>
        <p>Controle de infrações, IPVA, seguro e demais custos</p>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Multas pendentes</h3>
          <div className="value">{fines.filter((f) => f.status === "PENDING").length}</div>
        </div>
        <div className="card">
          <h3>Valor pendente</h3>
          <div className="value">R$ {pendingTotal.toFixed(2)}</div>
        </div>
        <div className="card">
          <h3>Despesas cadastradas</h3>
          <div className="value">{expenses.length}</div>
        </div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Registrar multa</h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void api
                .createFine({
                  vehicleId: fineForm.vehicleId,
                  description: fineForm.description,
                  amount: Number(fineForm.amount),
                  location: fineForm.location || undefined,
                })
                .then(load);
            }}
          >
            <div className="form-row">
              <label>Veículo</label>
              <select value={fineForm.vehicleId} onChange={(e) => setFineForm({ ...fineForm, vehicleId: e.target.value })} required>
                <option value="">Selecione…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Descrição</label>
              <input value={fineForm.description} onChange={(e) => setFineForm({ ...fineForm, description: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Valor (R$)</label>
              <input type="number" value={fineForm.amount} onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Local</label>
              <input value={fineForm.location} onChange={(e) => setFineForm({ ...fineForm, location: e.target.value })} />
            </div>
            <button type="submit" className="btn">Registrar</button>
          </form>
        </section>

        <section className="panel">
          <h3>Registrar despesa</h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void api
                .createExpense({
                  vehicleId: expenseForm.vehicleId,
                  category: expenseForm.category,
                  description: expenseForm.description,
                  amount: Number(expenseForm.amount),
                })
                .then(load);
            }}
          >
            <div className="form-row">
              <label>Veículo</label>
              <select value={expenseForm.vehicleId} onChange={(e) => setExpenseForm({ ...expenseForm, vehicleId: e.target.value })} required>
                <option value="">Selecione…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Categoria</label>
              <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as typeof expenseForm.category })}>
                <option value="IPVA">IPVA</option>
                <option value="INSURANCE">Seguro</option>
                <option value="LICENSE">Licenciamento</option>
                <option value="RENT">Aluguel</option>
                <option value="FINANCING">Financiamento</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div className="form-row">
              <label>Descrição</label>
              <input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Valor (R$)</label>
              <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
            </div>
            <button type="submit" className="btn">Registrar</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h3>Multas</h3>
        <table className="table">
          <thead>
            <tr><th>Veículo</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {fines.map((f) => (
              <tr key={f.id}>
                <td>{f.vehicle?.plate}</td>
                <td>{f.description}</td>
                <td>R$ {f.amount.toFixed(2)}</td>
                <td>{f.status}</td>
                <td>
                  {f.status === "PENDING" && (
                    <button type="button" className="btn btn-sm" onClick={() => void api.updateFineStatus(f.id, "PAID").then(load)}>
                      Marcar paga
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Despesas</h3>
        <table className="table">
          <thead>
            <tr><th>Veículo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.vehicle?.plate}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>R$ {e.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
