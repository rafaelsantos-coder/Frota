"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { api } from "@/lib/api";
import type { AccessProfileDto, UserDto } from "@frota/shared";

export function AdminUsuariosClient() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [profiles, setProfiles] = useState<AccessProfileDto[]>([]);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "OPERATOR" as "ADMIN" | "OPERATOR",
    profileId: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [u, p] = await Promise.all([api.getAdminUsers(), api.getAccessProfiles()]);
    setUsers(u);
    setProfiles(p);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createAdminUser({
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
        profileId: form.profileId || null,
      });
      setForm({ email: "", name: "", password: "", role: "OPERATOR", profileId: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  }

  async function toggleActive(user: UserDto) {
    await api.updateAdminUser(user.id, { active: user.active === false });
    await load();
  }

  return (
    <>
      <div className="page-header">
        <h2>Administração</h2>
        <p>Usuários, perfis de acesso, log e configuração de veículos</p>
      </div>
      <AdminNav />

      <div className="two-col">
        <form className="panel form-grid" onSubmit={(e) => void createUser(e)}>
          <h3>Novo usuário</h3>
          {error && <p className="error-text">{error}</p>}
          <div className="form-row">
            <label>Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </div>
          <div className="form-row">
            <label>Papel</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "OPERATOR" })}
            >
              <option value="OPERATOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="form-row">
            <label>Perfil de acesso</label>
            <select
              value={form.profileId}
              onChange={(e) => setForm({ ...form, profileId: e.target.value })}
            >
              <option value="">— Nenhum —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            Cadastrar usuário
          </button>
        </form>

        <div className="panel">
          <h3>Usuários ({users.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Perfil</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.profileName ?? "—"}</td>
                  <td>{u.active === false ? "Inativo" : "Ativo"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void toggleActive(u)}
                    >
                      {u.active === false ? "Ativar" : "Desativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
