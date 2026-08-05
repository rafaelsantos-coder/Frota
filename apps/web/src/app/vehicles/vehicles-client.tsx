"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { VehicleDto } from "@frota/shared";
import { api } from "@/lib/api";

function StatusBadge({ status }: { status: VehicleDto["trackerStatus"] }) {
  const className =
    status === "ONLINE"
      ? "badge badge-online"
      : status === "OFFLINE"
        ? "badge badge-offline"
        : "badge badge-unknown";
  return <span className={className}>{status}</span>;
}

export function VehiclesClient({ hideHeader = false }: { hideHeader?: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    plate: "",
    label: "",
    renavam: "",
    plateState: "",
    ownerDocument: "",
    trackerImei: "",
    cameraDeviceId: "",
  });

  async function load() {
    setLoading(true);
    try {
      setVehicles(await api.getVehicles());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar veículos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.createVehicle({
        plate: form.plate,
        label: form.label,
        renavam: form.renavam || undefined,
        plateState: form.plateState || undefined,
        ownerDocument: form.ownerDocument || undefined,
        trackerImei: form.trackerImei || undefined,
        cameraDeviceId: form.cameraDeviceId || undefined,
        cameraModel: form.cameraDeviceId ? "JC371" : undefined,
      });
      setForm({ plate: "", label: "", renavam: "", plateState: "", ownerDocument: "", trackerImei: "", cameraDeviceId: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar veículo");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este veículo?")) return;
    await api.deleteVehicle(id);
    await load();
  }

  return (
    <>
      {!hideHeader && (
        <div className="page-header">
          <h2>Veículos</h2>
          <p>Cada veículo possui um rastreador GT06 e uma câmera Jimi JC371 vinculados.</p>
        </div>
      )}

      <section className="panel">
        <h3>Adicionar veículo</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="two-col">
            <div className="form-row">
              <label htmlFor="plate">Placa</label>
              <input
                id="plate"
                value={form.plate}
                onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                placeholder="ABC1D23"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="label">Identificação</label>
              <input
                id="label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Caminhão 01"
                required
              />
            </div>
          </div>
          <div className="two-col">
            <div className="form-row">
              <label htmlFor="renavam">Renavam</label>
              <input
                id="renavam"
                value={form.renavam}
                onChange={(e) => setForm((f) => ({ ...f, renavam: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="plateState">UF</label>
              <input
                id="plateState"
                value={form.plateState}
                onChange={(e) => setForm((f) => ({ ...f, plateState: e.target.value.toUpperCase() }))}
                maxLength={2}
              />
            </div>
          </div>
          <div className="two-col">
            <div className="form-row">
              <label htmlFor="trackerImei">IMEI do rastreador GT06</label>
              <input
                id="trackerImei"
                value={form.trackerImei}
                onChange={(e) => setForm((f) => ({ ...f, trackerImei: e.target.value }))}
                placeholder="15 dígitos"
              />
              <small>Vincule o IMEI exibido no equipamento ou via SMS #imei#123456#</small>
            </div>
            <div className="form-row">
              <label htmlFor="cameraDeviceId">ID da câmera Jimi JC371</label>
              <input
                id="cameraDeviceId"
                value={form.cameraDeviceId}
                onChange={(e) => setForm((f) => ({ ...f, cameraDeviceId: e.target.value }))}
                placeholder="IMEI ou device ID Jimi"
              />
              <small>Será usado para associar webhooks /pushgps e /pushalarm</small>
            </div>
          </div>
          <button className="btn" type="submit">
            Cadastrar veículo
          </button>
        </form>
      </section>

      {error && <div className="panel">{error}</div>}

      <section className="panel">
        <h3>Frota cadastrada</h3>
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Carregando...</p>
        ) : vehicles.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Nenhum veículo cadastrado.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Nome</th>
                <th>Rastreador</th>
                <th>Status tracker</th>
                <th>Câmera JC371</th>
                <th>Status câmera</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate}</td>
                  <td>{vehicle.label}</td>
                  <td>{vehicle.trackerImei ?? "—"}</td>
                  <td>
                    <StatusBadge status={vehicle.trackerStatus} />
                  </td>
                  <td>{vehicle.cameraDeviceId ?? "—"}</td>
                  <td>
                    <StatusBadge status={vehicle.cameraStatus} />
                  </td>
                  <td>
                    <Link href={`/vehicles/${vehicle.id}`} className="btn btn-secondary btn-sm">
                      Abrir
                    </Link>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(vehicle.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
