"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export function CamerasClient() {
  const searchParams = useSearchParams();
  const [clips, setClips] = useState<Awaited<ReturnType<typeof api.getVideoClips>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [vehicleId, setVehicleId] = useState(searchParams.get("vehicleId") ?? "");
  const [live, setLive] = useState<Awaited<ReturnType<typeof api.startLiveStream>> | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [videoTime, setVideoTime] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.getVehicles().then(setVehicles);
  }, []);

  useEffect(() => {
    if (searchParams.get("vehicleId")) setVehicleId(searchParams.get("vehicleId")!);
  }, [searchParams]);

  useEffect(() => {
    void api.getVideoClips(vehicleId || undefined).then(setClips);
  }, [vehicleId]);

  const selected = vehicles.find((v) => v.id === vehicleId);

  async function handleLive() {
    if (!vehicleId) return;
    setLiveLoading(true);
    setMessage(null);
    try {
      const session = await api.startLiveStream(vehicleId);
      setLive(session);
      if ("error" in session && session.error) setMessage(String((session as { error?: string }).error));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao iniciar live");
    } finally {
      setLiveLoading(false);
    }
  }

  async function handleRequestVideo() {
    if (!vehicleId || !videoTime) return;
    setMessage(null);
    try {
      const res = await api.requestVideo(vehicleId, videoTime);
      setMessage(res.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao solicitar vídeo");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Câmeras JC371</h2>
        <p>Live view (20 min), vídeo sob demanda e biblioteca de clipes</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Todos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plate} — {v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <h3>Live view — {selected.plate}</h3>
          <p className="muted">Device ID: {selected.cameraDeviceId ?? "não configurado"}</p>
          <div className="live-controls">
            <button type="button" className="btn" onClick={() => void handleLive()} disabled={liveLoading || !selected.cameraDeviceId}>
              {liveLoading ? "Iniciando…" : "Iniciar live (20 min)"}
            </button>
          </div>
          {live?.streamUrl ? (
            <div className="video-placeholder">
              <strong>Stream ativo</strong>
              <a href={live.streamUrl} target="_blank" rel="noreferrer">Abrir stream RTMP/HLS</a>
              <small>Expira: {new Date(live.expiresAt).toLocaleString("pt-BR")}</small>
            </div>
          ) : (
            <div className="video-placeholder">
              <span>{live?.status === "PENDING" ? "Aguardando resposta da câmera…" : "Clique para iniciar transmissão ao vivo"}</span>
            </div>
          )}

          <h4 style={{ marginTop: 24 }}>Vídeo de 1 minuto sob demanda</h4>
          <div className="filters-row">
            <input
              type="datetime-local"
              value={videoTime}
              onChange={(e) => setVideoTime(e.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void handleRequestVideo()} disabled={!videoTime}>
              Solicitar vídeo
            </button>
          </div>
          {message && <p className="muted">{message}</p>}
        </div>
      )}

      <div className="panel">
        <h3>Biblioteca de clipes ({clips.length})</h3>
        <div className="clip-grid">
          {clips.map((clip) => (
            <div key={clip.id} className="clip-card">
              <div className="clip-thumb">
                {clip.fileName.endsWith(".mp4") ? "▶ Vídeo" : "🖼 Foto"}
              </div>
              <strong>{clip.vehicle?.plate ?? clip.vehicleId}</strong>
              <span className="muted">{clip.fileName}</span>
              <span className="muted">
                {clip.recordedAt
                  ? new Date(clip.recordedAt).toLocaleString("pt-BR")
                  : new Date(clip.createdAt).toLocaleString("pt-BR")}
              </span>
              {clip.fileUrl ? (
                <a href={clip.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm">Abrir</a>
              ) : (
                <span className="muted">Aguardando URL do Jimi storage</span>
              )}
            </div>
          ))}
        </div>
        {clips.length === 0 && (
          <p className="muted">Nenhum clipe recebido via webhook pushfileupload.</p>
        )}
      </div>
    </>
  );
}
