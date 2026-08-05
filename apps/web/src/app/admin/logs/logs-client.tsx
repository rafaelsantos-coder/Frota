"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { api } from "@/lib/api";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  USER_CREATE: "Usuário criado",
  USER_UPDATE: "Usuário alterado",
  PROFILE_CREATE: "Perfil criado",
  PROFILE_UPDATE: "Perfil alterado",
  PROFILE_DELETE: "Perfil excluído",
  VEHICLE_CREATE: "Veículo criado",
  VEHICLE_UPDATE: "Veículo alterado",
  VEHICLE_DELETE: "Veículo excluído",
};

export function AdminLogsClient() {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof api.getAuditLogs>>>([]);
  const [filter, setFilter] = useState("");

  async function load() {
    setLogs(await api.getAuditLogs(filter || undefined));
  }

  useEffect(() => {
    void load();
  }, [filter]);

  return (
    <>
      <div className="page-header">
        <h2>Administração — Log do sistema</h2>
        <p>Registro de ações dos usuários no sistema</p>
      </div>
      <AdminNav />

      <div className="panel">
        <div className="form-row" style={{ maxWidth: 280, marginBottom: 16 }}>
          <label>Filtrar ação</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                <td>{log.userName ?? log.userEmail ?? "—"}</td>
                <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                <td>
                  {log.entity ?? "—"}
                  {log.entityId && (
                    <span className="muted"> · {log.entityId.slice(0, 8)}…</span>
                  )}
                </td>
                <td>{log.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="muted">Nenhum registro encontrado.</p>}
      </div>
    </>
  );
}
