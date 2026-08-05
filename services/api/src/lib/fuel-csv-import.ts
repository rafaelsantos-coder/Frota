export type ParsedFuelCsvRow = {
  line: number;
  plate: string;
  liters: number;
  amountPaid: number;
  recordedAt: Date;
  odometerKm?: number;
  stationName?: string;
};

export type FuelCsvParseError = { line: number; message: string };

export type FuelCsvParseResult = {
  rows: ParsedFuelCsvRow[];
  errors: FuelCsvParseError[];
};

const PLATE_HEADERS = ["placa", "plate", "veiculo", "veículo", "vehicle"];
const LITERS_HEADERS = ["litros", "litro", "volume", "qtd", "quantidade"];
const AMOUNT_HEADERS = ["valor", "amount", "total", "valortotal", "valor_pago", "amountpaid"];
const DATE_HEADERS = ["data", "date", "recordedat", "datahora", "datetime"];
const ODOMETER_HEADERS = ["odometro", "odômetro", "km", "odometer", "hodometro"];
const STATION_HEADERS = ["posto", "station", "estabelecimento", "fornecedor"];

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === "," || ch === ";") && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = br;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }

  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function mapHeaderIndex(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(normalizeHeader(h), i));

  function find(candidates: string[]) {
    for (const c of candidates) {
      const idx = map.get(normalizeHeader(c));
      if (idx !== undefined) return idx;
    }
    for (const [key, idx] of map.entries()) {
      if (candidates.some((c) => key.includes(normalizeHeader(c)))) return idx;
    }
    return -1;
  }

  return {
    plate: find(PLATE_HEADERS),
    liters: find(LITERS_HEADERS),
    amount: find(AMOUNT_HEADERS),
    date: find(DATE_HEADERS),
    odometer: find(ODOMETER_HEADERS),
    station: find(STATION_HEADERS),
  };
}

export function parseFuelCsv(csvText: string): FuelCsvParseResult {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedFuelCsvRow[] = [];
  const errors: FuelCsvParseError[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: "Arquivo CSV vazio" }] };
  }

  const firstCells = parseCsvLine(lines[0]!);
  const headerMap = mapHeaderIndex(firstCells);
  const hasHeader =
    headerMap.plate >= 0 && headerMap.liters >= 0 && headerMap.amount >= 0 && headerMap.date >= 0;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (hasHeader && (headerMap.plate < 0 || headerMap.liters < 0 || headerMap.amount < 0)) {
    errors.push({
      line: 1,
      message: "Cabeçalho inválido. Use: placa, litros, valor, data (odometro e posto opcionais)",
    });
  }

  for (let i = 0; i < dataLines.length; i++) {
    const lineNo = hasHeader ? i + 2 : i + 1;
    const cells = parseCsvLine(dataLines[i]!);

    let plate: string;
    let liters: number | null;
    let amountPaid: number | null;
    let recordedAt: Date | null;
    let odometerKm: number | undefined;
    let stationName: string | undefined;

    if (hasHeader) {
      plate = cells[headerMap.plate] ?? "";
      liters = parseNumber(cells[headerMap.liters] ?? "");
      amountPaid = parseNumber(cells[headerMap.amount] ?? "");
      recordedAt = parseDate(cells[headerMap.date] ?? "");
      if (headerMap.odometer >= 0) {
        const odo = parseNumber(cells[headerMap.odometer] ?? "");
        if (odo !== null) odometerKm = odo;
      }
      if (headerMap.station >= 0) {
        const station = cells[headerMap.station]?.trim();
        if (station) stationName = station;
      }
    } else {
      plate = cells[0] ?? "";
      liters = parseNumber(cells[1] ?? "");
      amountPaid = parseNumber(cells[2] ?? "");
      recordedAt = parseDate(cells[3] ?? "");
      const odo = parseNumber(cells[4] ?? "");
      if (odo !== null) odometerKm = odo;
      const station = cells[5]?.trim();
      if (station) stationName = station;
    }

    if (!plate || liters === null || amountPaid === null || !recordedAt) {
      errors.push({ line: lineNo, message: "Placa, litros, valor ou data inválidos" });
      continue;
    }

    rows.push({
      line: lineNo,
      plate: normalizePlate(plate),
      liters,
      amountPaid,
      recordedAt,
      odometerKm,
      stationName,
    });
  }

  return { rows, errors };
}
