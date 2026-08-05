"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function ManutencaoClient() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof api.getMaintenanceOrders>>>([]);
  const [reminders, setReminders] = useState<Awaited<ReturnType<typeof api.getMaintenanceReminders>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [orderForm, setOrderForm] = useState<{
    vehicleId: string;
    type: import("@frota/shared").MaintenanceType;
    description: string;
    partsCost: string;
    laborCost: string;
    performedAt: string;
  }>({
    vehicleId: "",
    type: "PREVENTIVE",
    description: "",
    partsCost: "",
    laborCost: "",
    performedAt: new Date().toISOString().slice(0, 16),
  });
  const [reminderForm, setReminderForm] = useState({
    vehicleId: "",
    service: "",
    intervalKm: "",
    intervalDays: "",
  });

  async function load() {
    const [o, r, v] = await Promise.all([
      api.getMaintenanceOrders(),
      api.getMaintenanceReminders(),
      api.getVehicles(),
    ]);
    setOrders(o);
    setReminders(r);
    setVehicles(v);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Manutenção</h2>
        <p>Preventiva e corretiva com lembretes automáticos</p>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Registrar manutenção</h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void api
                .createMaintenanceOrder({
                  vehicleId: orderForm.vehicleId,
                  type: orderForm.type,
                  description: orderForm.description,
                  partsCost: orderForm.partsCost ? Number(orderForm.partsCost) : 0,
                  laborCost: orderForm.laborCost ? Number(orderForm.laborCost) : 0,
                  performedAt: new Date(orderForm.performedAt).toISOString(),
                })
                .then(load);
            }}
          >
            <div className="form-row">
              <label>Veículo</label>
              <select value={orderForm.vehicleId} onChange={(e) => setOrderForm({ ...orderForm, vehicleId: e.target.value })} required>
                <option value="">Selecione…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Tipo</label>
              <select value={orderForm.type} onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value as "PREVENTIVE" | "CORRECTIVE" })}>
                <option value="PREVENTIVE">Preventiva</option>
                <option value="CORRECTIVE">Corretiva</option>
              </select>
            </div>
            <div className="form-row">
              <label>Descrição</label>
              <input value={orderForm.description} onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Peças (R$)</label>
              <input type="number" value={orderForm.partsCost} onChange={(e) => setOrderForm({ ...orderForm, partsCost: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Mão de obra (R$)</label>
              <input type="number" value={orderForm.laborCost} onChange={(e) => setOrderForm({ ...orderForm, laborCost: e.target.value })} />
            </div>
            <button type="submit" className="btn">Salvar</button>
          </form>
        </section>

        <section className="panel">
          <h3>Lembrete preventivo</h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void api
                .createMaintenanceReminder({
                  vehicleId: reminderForm.vehicleId,
                  service: reminderForm.service,
                  intervalKm: reminderForm.intervalKm ? Number(reminderForm.intervalKm) : undefined,
                  intervalDays: reminderForm.intervalDays ? Number(reminderForm.intervalDays) : undefined,
                })
                .then(load);
            }}
          >
            <div className="form-row">
              <label>Veículo</label>
              <select value={reminderForm.vehicleId} onChange={(e) => setReminderForm({ ...reminderForm, vehicleId: e.target.value })} required>
                <option value="">Selecione…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Serviço</label>
              <input value={reminderForm.service} onChange={(e) => setReminderForm({ ...reminderForm, service: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Intervalo (km)</label>
              <input type="number" value={reminderForm.intervalKm} onChange={(e) => setReminderForm({ ...reminderForm, intervalKm: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Intervalo (dias)</label>
              <input type="number" value={reminderForm.intervalDays} onChange={(e) => setReminderForm({ ...reminderForm, intervalDays: e.target.value })} />
            </div>
            <button type="submit" className="btn">Criar lembrete</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h3>Lembretes {reminders.filter((r) => r.dueSoon).length > 0 && <span className="badge badge-warn">Vencendo</span>}</h3>
        <table className="table">
          <thead>
            <tr><th>Veículo</th><th>Serviço</th><th>Km</th><th>Dias</th><th>Status</th></tr>
          </thead>
          <tbody>
            {reminders.map((r) => (
              <tr key={r.id} className={r.dueSoon ? "row-warn" : undefined}>
                <td>{r.vehicle?.plate}</td>
                <td>{r.service}</td>
                <td>{r.intervalKm ?? "—"}</td>
                <td>{r.intervalDays ?? "—"}</td>
                <td>{r.dueSoon ? "Próximo do vencimento" : "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Histórico de manutenções</h3>
        <table className="table">
          <thead>
            <tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Custo</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.performedAt).toLocaleDateString("pt-BR")}</td>
                <td>{o.vehicle?.plate}</td>
                <td>{o.type === "PREVENTIVE" ? "Preventiva" : "Corretiva"}</td>
                <td>{o.description}</td>
                <td>R$ {(o.partsCost + o.laborCost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
