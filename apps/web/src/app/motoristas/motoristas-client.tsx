"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { extractPhotoFromCnhDocument } from "@/lib/cnh-photo-crop";

type DriverForm = {
  name: string;
  cpf: string;
  rg: string;
  cnh: string;
  birthDate: string;
  cnhExpiry: string;
  photoData: string;
  rfidTag: string;
};

const emptyForm: DriverForm = {
  name: "",
  cpf: "",
  rg: "",
  cnh: "",
  birthDate: "",
  cnhExpiry: "",
  photoData: "",
  rfidTag: "",
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlMime(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match?.[1] ?? "image/jpeg";
}

function dataUrlBase64(dataUrl: string) {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export function MotoristasClient() {
  const [drivers, setDrivers] = useState<Awaited<ReturnType<typeof api.getDrivers>>>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof api.getDriverRanking>>>([]);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const avgScore =
    ranking.length > 0
      ? Math.round(ranking.reduce((sum, r) => sum + r.score, 0) / ranking.length)
      : null;
  const topScore = ranking.length > 0 ? Math.max(...ranking.map((r) => r.score)) : null;

  async function load() {
    const [d, v, r] = await Promise.all([
      api.getDrivers(),
      api.getVehicles(),
      api.getDriverRanking(),
    ]);
    setDrivers(d);
    setVehicles(v);
    setRanking(r);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCnhUpload(file: File) {
    setExtractMsg(null);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setExtractMsg("Envie JPEG, PNG, WebP ou PDF da CNH digital.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const mimeType = isPdf ? "application/pdf" : dataUrlMime(dataUrl);
    setExtracting(true);
    try {
      const extracted = await api.extractCnhFromDocument(dataUrlBase64(dataUrl), mimeType);
      if (extracted.message && !extracted.name) {
        setExtractMsg(extracted.message);
      } else {
        let photoData = "";
        try {
          photoData = await extractPhotoFromCnhDocument(file, extracted.photoBox);
        } catch {
          /* foto manual ainda disponível */
        }
        setForm((prev) => ({
          ...prev,
          name: extracted.name ?? prev.name,
          cpf: extracted.cpf ?? prev.cpf,
          rg: extracted.rg ?? prev.rg,
          cnh: extracted.cnh ?? prev.cnh,
          birthDate: extracted.birthDate ?? prev.birthDate,
          cnhExpiry: extracted.cnhExpiry ?? prev.cnhExpiry,
          photoData: photoData || prev.photoData,
        }));
        setExtractMsg(
          photoData
            ? "Dados e foto extraídos da CNH. Revise antes de cadastrar."
            : "Dados extraídos da CNH. Revise a foto de perfil antes de cadastrar.",
        );
      }
    } catch (err) {
      setExtractMsg(err instanceof Error ? err.message : "Erro na extração");
    } finally {
      setExtracting(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({ ...prev, photoData: dataUrl }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.createDriver({
      name: form.name,
      cpf: form.cpf || undefined,
      rg: form.rg || undefined,
      cnh: form.cnh || undefined,
      birthDate: form.birthDate || undefined,
      cnhExpiry: form.cnhExpiry || undefined,
      photoData: form.photoData || undefined,
      rfidTag: form.rfidTag || undefined,
    });
    setForm(emptyForm);
    setExtractMsg(null);
    setShowForm(false);
    await load();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Motoristas</h2>
          <p>Cadastro com CNH digital (IA), foto 4x4, RFID/iButton e ranking</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className={showForm ? "btn btn-secondary" : "btn"}
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? "Fechar formulário" : "Novo motorista"}
          </button>
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Motoristas cadastrados</h3>
          <div className="value">{drivers.length}</div>
        </div>
        <div className="card">
          <h3>Score médio (30 dias)</h3>
          <div className="value">{avgScore ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Melhor score</h3>
          <div className="value">{topScore ?? "—"}</div>
        </div>
      </div>

      {showForm && (
        <section className="panel">
          <h3>Novo motorista</h3>
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid form-grid-2">
            <div className="form-row form-row-span-2 driver-form-uploads">
              <div className="form-row">
                <label>CNH digital / foto da carteira</label>
                <input
                  ref={cnhInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                  className="file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCnhUpload(file);
                  }}
                />
                <small className="muted">
                  Anexe a CNH digital em PDF, JPEG ou PNG. A IA preenche os campos automaticamente.
                </small>
                {extracting && <p className="muted">Extraindo dados com IA…</p>}
                {extractMsg && <p className="muted">{extractMsg}</p>}
              </div>
              <div className="form-row driver-photo-row">
                <label>Foto do motorista (4x4)</label>
                <div className="driver-photo-box">
                  {form.photoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.photoData} alt="Foto motorista" className="driver-photo-preview" />
                  ) : (
                    <span className="muted">Extraída automaticamente da CNH</span>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handlePhotoUpload(file);
                    }}
                  />
                  <small className="muted">Opcional: substituir a foto extraída da CNH</small>
                </div>
              </div>
            </div>

            <div className="form-row form-row-span-2">
              <label>Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>CPF</label>
              <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="form-row">
              <label>RG</label>
              <input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
            </div>
            <div className="form-row">
              <label>CNH (nº registro)</label>
              <input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} />
            </div>
            <div className="form-row">
              <label>RFID / iButton</label>
              <input
                value={form.rfidTag}
                onChange={(e) => setForm({ ...form, rfidTag: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Data de nascimento</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Validade da CNH</label>
              <input
                type="date"
                value={form.cnhExpiry}
                onChange={(e) => setForm({ ...form, cnhExpiry: e.target.value })}
              />
            </div>
            <div className="form-row form-row-span-2 form-actions">
              <button type="submit" className="btn" disabled={extracting}>
                Cadastrar motorista
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <h3>Ranking (30 dias)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Score</th>
                <th>DMS</th>
                <th>Excessos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum dado de ranking no período.
                  </td>
                </tr>
              ) : (
                ranking.map((r) => (
                  <tr key={r.driverId}>
                    <td>{r.name}</td>
                    <td>
                      <span
                        className={`score score-${r.score >= 80 ? "good" : r.score >= 50 ? "mid" : "bad"}`}
                      >
                        {r.score}
                      </span>
                    </td>
                    <td>{r.dmsAlertCount}</td>
                    <td>{r.speedViolationCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Motoristas cadastrados ({drivers.length})</h3>
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>CNH</th>
              <th>Validade</th>
              <th>RFID</th>
              <th>Veículo</th>
              <th>Vincular</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photoUrl} alt="" className="driver-photo-thumb" />
                  ) : (
                    "—"
                  )}
                </td>
                <td>{d.name}</td>
                <td>{d.cpf ?? "—"}</td>
                <td>{d.cnh ?? "—"}</td>
                <td>{d.cnhExpiry ?? "—"}</td>
                <td>{d.rfidTag ?? "—"}</td>
                <td>{d.currentVehicle ? d.currentVehicle.plate : "—"}</td>
                <td>
                  <select
                    value={assignMap[d.id] ?? ""}
                    onChange={(e) => setAssignMap({ ...assignMap, [d.id]: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!assignMap[d.id]}
                    onClick={() => void api.assignDriver(d.id, assignMap[d.id]!).then(load)}
                  >
                    Vincular
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void api.deleteDriver(d.id).then(load)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </>
  );
}
