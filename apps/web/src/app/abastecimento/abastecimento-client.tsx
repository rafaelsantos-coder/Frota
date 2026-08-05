"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export function AbastecimentoClient() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.getFuelEntries>>>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getFuelStats>> | null>(null);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof api.getVehicles>>>([]);
  const [stations, setStations] = useState<Awaited<ReturnType<typeof api.getFuelStations>>>([]);
  const [form, setForm] = useState({
    vehicleId: "",
    liters: "",
    amountPaid: "",
    odometerKm: "",
    stationId: "",
    recordedAt: new Date().toISOString().slice(0, 16),
  });
  const [stationForm, setStationForm] = useState({
    name: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
  });
  const [showStationForm, setShowStationForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStationId, setImportStationId] = useState("");
  const [createStationsOnImport, setCreateStationsOnImport] = useState(true);
  const [importResult, setImportResult] = useState<Awaited<
    ReturnType<typeof api.importFuelCsv>
  > | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [e, s, v, st] = await Promise.all([
      api.getFuelEntries(),
      api.getFuelStats(),
      api.getVehicles(),
      api.getFuelStations(),
    ]);
    setEntries(e);
    setStats(s);
    setVehicles(v);
    setStations(st);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const station = stations.find((s) => s.id === form.stationId);
    await api.createFuelEntry({
      vehicleId: form.vehicleId,
      stationId: form.stationId || undefined,
      liters: Number(form.liters),
      amountPaid: Number(form.amountPaid),
      odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
      station: station?.name,
      recordedAt: new Date(form.recordedAt).toISOString(),
    });
    setForm({ ...form, liters: "", amountPaid: "", odometerKm: "", stationId: "" });
    await load();
  }

  async function handleCreateStation(e: React.FormEvent) {
    e.preventDefault();
    await api.createFuelStation({
      name: stationForm.name,
      cnpj: stationForm.cnpj || undefined,
      address: stationForm.address || undefined,
      city: stationForm.city || undefined,
      state: stationForm.state || undefined,
    });
    setStationForm({ name: "", cnpj: "", address: "", city: "", state: "" });
    setShowStationForm(false);
    await load();
  }

  async function handleCsvImport(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const csv = await file.text();
      const result = await api.importFuelCsv({
        csv,
        defaultStationId: importStationId || undefined,
        createStations: createStationsOnImport,
      });
      setImportResult(result);
      await load();
    } catch (err) {
      setImportResult({
        imported: 0,
        skipped: 0,
        stationsCreated: 0,
        errors: [{ line: 0, message: err instanceof Error ? err.message : "Erro na importação" }],
      });
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Abastecimento</h2>
          <p>Controle de litros, custos, postos e importação de relatórios CSV</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? "Fechar importação" : "Importar CSV"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowStationForm((v) => !v)}
          >
            {showStationForm ? "Fechar postos" : "Cadastrar posto"}
          </button>
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Litros (30 dias)</h3>
          <div className="value">{stats?.totalLiters.toFixed(1) ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Custo total</h3>
          <div className="value">R$ {stats?.totalCost.toFixed(2) ?? "—"}</div>
        </div>
        <div className="card">
          <h3>Postos cadastrados</h3>
          <div className="value">{stations.length}</div>
        </div>
      </div>

      {showImport && (
        <section className="panel">
          <h3>Importar relatório CSV do posto</h3>
          <p className="muted import-help">
            Colunas aceitas: <code>placa</code>, <code>litros</code>, <code>valor</code>,{" "}
            <code>data</code> (obrigatórias). Opcionais: <code>odometro</code>, <code>posto</code>.
            Separador vírgula ou ponto-e-vírgula. Data: <code>DD/MM/AAAA HH:MM</code> ou ISO.
          </p>
          <div className="form-grid form-grid-2">
            <div className="form-row">
              <label>Posto padrão (se CSV não tiver coluna posto)</label>
              <select
                value={importStationId}
                onChange={(e) => setImportStationId(e.target.value)}
              >
                <option value="">Nenhum / usar coluna posto</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={createStationsOnImport}
                  onChange={(e) => setCreateStationsOnImport(e.target.checked)}
                />
                Criar postos automaticamente a partir da coluna &quot;posto&quot;
              </label>
            </div>
            <div className="form-row form-row-span-2">
              <label>Arquivo CSV</label>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="file-input"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvImport(file);
                }}
              />
              {importing && <p className="muted">Importando…</p>}
            </div>
          </div>
          {importResult && (
            <div className="import-result">
              <p>
                <strong>{importResult.imported}</strong> lançamentos importados
                {importResult.stationsCreated > 0 &&
                  ` · ${importResult.stationsCreated} posto(s) criado(s)`}
                {importResult.errors.length > 0 &&
                  ` · ${importResult.errors.length} aviso(s)/erro(s)`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="import-errors">
                  {importResult.errors.slice(0, 8).map((err, i) => (
                    <li key={`${err.line}-${i}`}>
                      Linha {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {showStationForm && (
        <section className="panel">
          <h3>Novo posto de combustível</h3>
          <form onSubmit={(e) => void handleCreateStation(e)} className="form-grid form-grid-2">
            <div className="form-row form-row-span-2">
              <label>Nome do posto *</label>
              <input
                value={stationForm.name}
                onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>CNPJ</label>
              <input
                value={stationForm.cnpj}
                onChange={(e) => setStationForm({ ...stationForm, cnpj: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Cidade</label>
              <input
                value={stationForm.city}
                onChange={(e) => setStationForm({ ...stationForm, city: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>UF</label>
              <input
                value={stationForm.state}
                onChange={(e) => setStationForm({ ...stationForm, state: e.target.value })}
                maxLength={2}
              />
            </div>
            <div className="form-row">
              <label>Endereço</label>
              <input
                value={stationForm.address}
                onChange={(e) => setStationForm({ ...stationForm, address: e.target.value })}
              />
            </div>
            <div className="form-row form-row-span-2 form-actions">
              <button type="submit" className="btn">
                Salvar posto
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="two-col">
        <section className="panel">
          <h3>Lançar abastecimento</h3>
          <form onSubmit={(e) => void handleSubmit(e)} className="form-stack">
            <div className="form-row">
              <label>Veículo</label>
              <select
                value={form.vehicleId}
                onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                required
              >
                <option value="">Selecione…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} — {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Posto</label>
              <select
                value={form.stationId}
                onChange={(e) => setForm({ ...form, stationId: e.target.value })}
              >
                <option value="">Selecione…</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Litros</label>
              <input
                type="number"
                step="0.01"
                value={form.liters}
                onChange={(e) => setForm({ ...form, liters: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Valor pago (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.amountPaid}
                onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Odômetro (km)</label>
              <input
                type="number"
                value={form.odometerKm}
                onChange={(e) => setForm({ ...form, odometerKm: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Data</label>
              <input
                type="datetime-local"
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </div>
            <button type="submit" className="btn">
              Registrar
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Postos cadastrados</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade</th>
                  <th>Lançamentos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Nenhum posto cadastrado.
                    </td>
                  </tr>
                ) : (
                  stations.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.city ?? "—"}</td>
                      <td>{s.entryCount ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void api.deleteFuelStation(s.id).then(load)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <h3>Por veículo (30 dias)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Litros</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {stats?.byVehicle.map((v) => (
                <tr key={v.vehicleId}>
                  <td>{v.plate}</td>
                  <td>{v.liters}</td>
                  <td>R$ {v.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Histórico</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>Litros</th>
                <th>Valor</th>
                <th>Posto</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.recordedAt).toLocaleString("pt-BR")}</td>
                  <td>{e.vehicle?.plate}</td>
                  <td>{e.liters}</td>
                  <td>R$ {e.amountPaid.toFixed(2)}</td>
                  <td>{e.station ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
