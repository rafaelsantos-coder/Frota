"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function ChecklistClient() {
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof api.getChecklistTemplates>>>([]);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.getChecklistEntries>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [templateId, setTemplateId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  async function load() {
    const [t, e, v] = await Promise.all([
      api.getChecklistTemplates(),
      api.getChecklistEntries(),
      api.getVehicles(),
    ]);
    setTemplates(t);
    setEntries(e);
    setVehicles(v);
    if (t[0] && !templateId) setTemplateId(t[0].id);
  }

  useEffect(() => {
    void load();
  }, []);

  const template = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (template) {
      const initial: Record<string, boolean> = {};
      for (const item of template.items) initial[item.label] = false;
      setAnswers(initial);
    }
  }, [template]);

  return (
    <>
      <div className="page-header">
        <h2>Checklist diário</h2>
        <p>Conformidade do veículo e segurança operacional</p>
      </div>

      <section className="panel">
        <h3>Preencher checklist</h3>
        <div className="filters-row">
          <div className="form-row">
            <label>Modelo</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Veículo</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Selecione…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate}</option>
              ))}
            </select>
          </div>
        </div>

        {template && (
          <div className="checklist-items">
            {template.items.map((item: { label: string; required: boolean }) => (
              <label key={item.label} className="checklist-item">
                <input
                  type="checkbox"
                  checked={answers[item.label] ?? false}
                  onChange={(e) => setAnswers({ ...answers, [item.label]: e.target.checked })}
                />
                {item.label}
                {item.required && <span className="badge">Obrigatório</span>}
              </label>
            ))}
            <button
              type="button"
              className="btn"
              disabled={!vehicleId || !templateId}
              onClick={() =>
                void api
                  .submitChecklist({ vehicleId, templateId, answers })
                  .then(load)
              }
            >
              Enviar checklist
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Histórico ({entries.length})</h3>
        <table className="table">
          <thead>
            <tr><th>Data</th><th>Veículo</th><th>Modelo</th><th>Itens OK</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const ok = Object.values(e.answers).filter(Boolean).length;
              const total = Object.keys(e.answers).length;
              return (
                <tr key={e.id}>
                  <td>{new Date(e.submittedAt).toLocaleString("pt-BR")}</td>
                  <td>{e.vehicle?.plate}</td>
                  <td>{e.template?.name}</td>
                  <td>{ok}/{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
