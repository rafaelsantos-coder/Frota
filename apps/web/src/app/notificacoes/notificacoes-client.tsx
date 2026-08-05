"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function NotificacoesClient() {
  const [email, setEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [onCritical, setOnCritical] = useState(true);
  const [onHigh, setOnHigh] = useState(true);
  const [onTelegram, setOnTelegram] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const prefs = await api.getNotificationPrefs();
      const pref = prefs[0];
      if (!pref) return;
      setEmail(pref.email ?? "");
      setTelegramChatId(pref.telegramChatId ?? "");
      setOnCritical(pref.onCritical);
      setOnHigh(pref.onHigh);
      setOnTelegram(pref.onTelegram);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.saveNotificationPrefs({
      email: email || null,
      telegramChatId: telegramChatId || null,
      onCritical,
      onHigh,
      onTelegram,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      <div className="page-header">
        <h2>Notificações</h2>
        <p>Alertas críticos e de alta prioridade por e-mail e Telegram</p>
      </div>

      <form className="panel form-grid" style={{ maxWidth: 520 }} onSubmit={(e) => void save(e)}>
        <div className="form-row">
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alertas@suaempresa.com"
          />
        </div>
        <div className="form-row">
          <label>Telegram Chat ID</label>
          <input
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="Ex: 123456789"
          />
          <small className="muted">
            Crie um bot via @BotFather e obtenha seu chat ID com @userinfobot
          </small>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={onCritical} onChange={(e) => setOnCritical(e.target.checked)} />
          Alertas críticos
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={onHigh} onChange={(e) => setOnHigh(e.target.checked)} />
          Alertas de alta prioridade
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={onTelegram} onChange={(e) => setOnTelegram(e.target.checked)} />
          Enviar via Telegram
        </label>
        <button type="submit" className="btn">
          Salvar preferências
        </button>
        {saved && <p className="muted">Preferências salvas.</p>}
      </form>
    </>
  );
}
