"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { api } from "@/lib/api";
import { PERMISSION_LABELS, type Permission } from "@frota/shared";

export function AdminPerfisClient() {
  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof api.getAccessProfiles>>>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);

  async function load() {
    setProfiles(await api.getAccessProfiles());
  }

  useEffect(() => {
    void load();
  }, []);

  function togglePermission(key: Permission) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    if (permissions.length === 0) return;
    await api.createAccessProfile({ name, description: description || undefined, permissions });
    setName("");
    setDescription("");
    setPermissions([]);
    await load();
  }

  async function removeProfile(id: string, isSystem: boolean) {
    if (isSystem) return;
    if (!confirm("Excluir este perfil?")) return;
    await api.deleteAccessProfile(id);
    await load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Administração — Perfis de acesso</h2>
        <p>Defina o que cada perfil pode fazer no sistema</p>
      </div>
      <AdminNav />

      <div className="two-col">
        <form className="panel form-grid" onSubmit={(e) => void createProfile(e)}>
          <h3>Novo perfil</h3>
          <div className="form-row">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Descrição</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Permissões</label>
            <div className="permission-grid">
              {(Object.keys(PERMISSION_LABELS) as Permission[]).map((key) => (
                <label key={key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={permissions.includes(key)}
                    onChange={() => togglePermission(key)}
                  />
                  {PERMISSION_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn" disabled={permissions.length === 0}>
            Criar perfil
          </button>
        </form>

        <div className="panel">
          <h3>Perfis cadastrados ({profiles.length})</h3>
          {profiles.map((p) => (
            <div key={p.id} className="fence-item" style={{ marginBottom: 12 }}>
              <strong>{p.name}</strong>
              {p.isSystem && <span className="badge badge-unknown" style={{ marginLeft: 8 }}>Sistema</span>}
              <p className="muted">{p.description ?? "—"}</p>
              <p className="muted">{p.permissions.length} permissões · {p.userCount ?? 0} usuários</p>
              {!p.isSystem && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void removeProfile(p.id, p.isSystem)}
                >
                  Excluir
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
