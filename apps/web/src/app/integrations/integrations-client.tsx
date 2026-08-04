"use client";

import { useEffect, useState } from "react";
import type { Gt06IntegrationDto, JimiIntegrationDto } from "@frota/shared";
import { api } from "@/lib/api";

export function IntegrationsClient() {
  const [jimi, setJimi] = useState<JimiIntegrationDto | null>(null);
  const [gt06, setGt06] = useState<Gt06IntegrationDto | null>(null);
  const [jimiForm, setJimiForm] = useState({
    label: "Jimi IoT Hub (JC371)",
    appKey: "",
    appSecret: "",
    pushUrl: "",
    apiBaseUrl: "https://hk-open.tracksolidpro.com/route/rest",
    enabled: false,
  });
  const [gt06Form, setGt06Form] = useState({
    label: "Servidor GT06",
    host: "localhost",
    port: 5023,
    enabled: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [jimiData, gt06Data] = await Promise.all([
          api.getJimiIntegration(),
          api.getGt06Integration(),
        ]);
        setJimi(jimiData);
        setGt06(gt06Data);
        setJimiForm((current) => ({
          ...current,
          label: jimiData.label,
          appKey: jimiData.appKey ?? "",
          pushUrl: jimiData.pushUrl ?? "",
          apiBaseUrl: jimiData.apiBaseUrl,
          enabled: jimiData.enabled,
        }));
        setGt06Form({
          label: gt06Data.label,
          host: gt06Data.host,
          port: gt06Data.port,
          enabled: gt06Data.enabled,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar integrações");
      }
    })();
  }, []);

  const suggestedPushBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3001/integrations/jimi`
      : "http://SEU_SERVIDOR:3001/integrations/jimi";

  async function saveJimi(event: React.FormEvent) {
    event.preventDefault();
    try {
      const saved = await api.saveJimiIntegration({
        label: jimiForm.label,
        appKey: jimiForm.appKey || null,
        appSecret: jimiForm.appSecret || null,
        pushUrl: jimiForm.pushUrl || null,
        apiBaseUrl: jimiForm.apiBaseUrl,
        enabled: jimiForm.enabled,
      });
      setJimi(saved);
      setJimiForm((current) => ({ ...current, appSecret: "" }));
      setMessage("Integração Jimi salva. O appSecret fica armazenado no servidor.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar Jimi");
    }
  }

  async function saveGt06(event: React.FormEvent) {
    event.preventDefault();
    try {
      const saved = await api.saveGt06Integration(gt06Form);
      setGt06(saved);
      setMessage("Configuração GT06 salva.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar GT06");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Integrações</h2>
        <p>Configure credenciais Jimi e parâmetros do servidor GT06 manualmente no painel.</p>
      </div>

      {message && <div className="panel">{message}</div>}
      {error && <div className="panel">{error}</div>}

      <section className="panel">
        <h3>Jimi IoT Hub — Câmera JC371</h3>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Quando você obtiver as credenciais, preencha appKey e appSecret aqui. O secret não é
          exibido novamente após salvar.
        </p>
        <form className="form-grid" onSubmit={saveJimi}>
          <div className="form-row">
            <label htmlFor="jimi-label">Nome da integração</label>
            <input
              id="jimi-label"
              value={jimiForm.label}
              onChange={(e) => setJimiForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="two-col">
            <div className="form-row">
              <label htmlFor="jimi-appKey">appKey</label>
              <input
                id="jimi-appKey"
                value={jimiForm.appKey}
                onChange={(e) => setJimiForm((f) => ({ ...f, appKey: e.target.value }))}
                placeholder="Preencher quando receber da Jimi"
              />
            </div>
            <div className="form-row">
              <label htmlFor="jimi-appSecret">appSecret</label>
              <input
                id="jimi-appSecret"
                type="password"
                value={jimiForm.appSecret}
                onChange={(e) => setJimiForm((f) => ({ ...f, appSecret: e.target.value }))}
                placeholder={
                  jimi?.appSecretConfigured
                    ? "Já configurado — digite para substituir"
                    : "Preencher quando receber da Jimi"
                }
              />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="jimi-pushUrl">Push URL (configurar no IoT Hub Jimi)</label>
            <input
              id="jimi-pushUrl"
              value={jimiForm.pushUrl}
              onChange={(e) => setJimiForm((f) => ({ ...f, pushUrl: e.target.value }))}
              placeholder={`${suggestedPushBase}/pushgps`}
            />
            <small>
              Endpoints disponíveis: /pushgps · /pushalarm · /pushIothubEvent · /pushfileupload
            </small>
          </div>
          <div className="form-row">
            <label htmlFor="jimi-api">API Base URL</label>
            <input
              id="jimi-api"
              value={jimiForm.apiBaseUrl}
              onChange={(e) => setJimiForm((f) => ({ ...f, apiBaseUrl: e.target.value }))}
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={jimiForm.enabled}
              onChange={(e) => setJimiForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Integração Jimi ativa
          </label>
          <button className="btn" type="submit">
            Salvar integração Jimi
          </button>
        </form>
      </section>

      <section className="panel">
        <h3>Servidor GT06 — Rastreador WIC Smart GPS</h3>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Durante a migração paralela, novos veículos piloto apontam para este host/porta. SmartGPS
          (smartconn.mine.nu) continua operando a frota legada.
        </p>
        <form className="form-grid" onSubmit={saveGt06}>
          <div className="form-row">
            <label htmlFor="gt06-label">Nome</label>
            <input
              id="gt06-label"
              value={gt06Form.label}
              onChange={(e) => setGt06Form((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="two-col">
            <div className="form-row">
              <label htmlFor="gt06-host">Host público</label>
              <input
                id="gt06-host"
                value={gt06Form.host}
                onChange={(e) => setGt06Form((f) => ({ ...f, host: e.target.value }))}
                placeholder="tracking.seudominio.com.br"
              />
              <small>Use este host no SMS: #ip#123456#HOST#PORT#</small>
            </div>
            <div className="form-row">
              <label htmlFor="gt06-port">Porta TCP</label>
              <input
                id="gt06-port"
                type="number"
                value={gt06Form.port}
                onChange={(e) => setGt06Form((f) => ({ ...f, port: Number(e.target.value) }))}
              />
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={gt06Form.enabled}
              onChange={(e) => setGt06Form((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Servidor GT06 ativo
          </label>
          <button className="btn" type="submit">
            Salvar configuração GT06
          </button>
        </form>
      </section>
    </>
  );
}
