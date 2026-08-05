"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export function CamerasClient() {
  const searchParams = useSearchParams();
  const [clips, setClips] = useState<Awaited<ReturnType<typeof api.getVideoClips>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [vehicleId, setVehicleId] = useState(searchParams.get("vehicleId") ?? "");

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

  return (
    <>
      <div className="page-header">
        <h2>Câmeras JC371</h2>
        <p>Clipes de eventos e live view (requer credenciais Jimi configuradas)</p>
      </div>

      <div className="panel filters-row">
        <div className="form-row">
          <label>Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Todos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} — {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <h3>Live view — {selected.plate}</h3>
          <p className="muted">
            Para transmissão ao vivo, configure appKey/appSecret Jimi em Integrações. O sistema
            enviará comando RTMP para a câmera JC371 (protocolo Jimi IoT Hub).
          </p>
          <div className="video-placeholder">
            <span>Live stream disponível após integração Jimi completa</span>
            <small>Device ID: {selected.cameraDeviceId ?? "não configurado"}</small>
          </div>
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
                <a href={clip.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                  Abrir
                </a>
              ) : (
                <span className="muted">Aguardando URL do Jimi storage</span>
              )}
            </div>
          ))}
        </div>
        {clips.length === 0 && (
          <p className="muted">
            Nenhum clipe recebido. Quando a JC371 enviar eventos DMS, os arquivos chegam via
            webhook pushfileupload.
          </p>
        )}
      </div>
    </>
  );
}
