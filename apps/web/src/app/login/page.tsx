"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { FiberBackground } from "@/components/fiber-background";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      setToken(result.token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-layout">
      <div className="login-hero">
        <FiberBackground variant="full" />
        <div className="login-hero-content">
          <BrandLogo variant="login" />
          <p className="login-tagline">Gestão de Frota inteligente</p>
          <p className="login-sub">Rastreamento GT06 · Câmeras Jimi · Operações completas</p>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <h2>Entrar</h2>
          <p>Use suas credenciais Sulnet</p>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-row">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sulnet.com"
                required
                autoComplete="username"
              />
            </div>
            <div className="form-row">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
