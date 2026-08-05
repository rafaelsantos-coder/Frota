const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "frota_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Sessão expirada");
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  const ct = response.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return response.json() as Promise<T>;
  return response.text() as Promise<T>;
}

async function download(path: string, filename: string) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Falha no download");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function qs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  login: (email: string, password: string) =>
    request<import("@frota/shared").AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<import("@frota/shared").UserDto>("/auth/me"),
  logout: () => clearToken(),

  getVehicles: () => request<import("@frota/shared").VehicleDto[]>("/vehicles"),
  getVehicle: (id: string) => request<import("@frota/shared").VehicleDto>(`/vehicles/${id}`),
  createVehicle: (body: import("@frota/shared").CreateVehicleInput) =>
    request<import("@frota/shared").VehicleDto>("/vehicles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteVehicle: (id: string) => request<void>(`/vehicles/${id}`, { method: "DELETE" }),

  getDrivers: () => request<import("@frota/shared").DriverDto[]>("/drivers"),
  createDriver: (body: import("@frota/shared").CreateDriverInput) =>
    request<import("@frota/shared").DriverDto>("/drivers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteDriver: (id: string) => request<void>(`/drivers/${id}`, { method: "DELETE" }),
  assignDriver: (driverId: string, vehicleId: string) =>
    request<import("@frota/shared").DriverDto>(`/drivers/${driverId}/assign`, {
      method: "POST",
      body: JSON.stringify({ vehicleId }),
    }),
  getDriverRanking: () =>
    request<import("@frota/shared").DriverReportDto[]>("/drivers/ranking"),

  getJimiIntegration: () =>
    request<import("@frota/shared").JimiIntegrationDto>("/integrations/jimi"),
  saveJimiIntegration: (body: import("@frota/shared").UpsertJimiIntegrationInput) =>
    request<import("@frota/shared").JimiIntegrationDto>("/integrations/jimi", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getGt06Integration: () =>
    request<import("@frota/shared").Gt06IntegrationDto>("/integrations/gt06"),
  saveGt06Integration: (body: import("@frota/shared").UpsertGt06IntegrationInput) =>
    request<import("@frota/shared").Gt06IntegrationDto>("/integrations/gt06", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getIntegrationStatus: () =>
    request<{
      jimi: { configured: boolean; enabled: boolean; pushUrl: string | null };
      gt06: { enabled: boolean; host: string; port: number; activeSessions: number };
      vehicles: number;
    }>("/integrations/status"),

  getLatestPositions: () =>
    request<
      Array<{
        vehicle: { id: string; plate: string; label: string };
        position: import("@frota/shared").PositionDto;
      }>
    >("/positions/latest"),
  getLivePositions: () =>
    request<
      Array<{
        vehicle: import("@frota/shared").VehicleDto;
        position: import("@frota/shared").PositionDto | null;
      }>
    >("/positions/live"),
  getPositionHistory: (vehicleId: string, from?: string, to?: string) =>
    request<import("@frota/shared").PositionDto[]>(
      `/positions/history${qs({ vehicleId, from, to })}`,
    ),
  getStopPoints: (vehicleId: string, from?: string, to?: string) =>
    request<import("@frota/shared").StopPointDto[]>(
      `/positions/stops${qs({ vehicleId, from, to })}`,
    ),
  getRouteEvents: (vehicleId: string, from?: string, to?: string) =>
    request<import("@frota/shared").RouteEventDto[]>(
      `/positions/events${qs({ vehicleId, from, to })}`,
    ),
  getPositionTrail: (vehicleId: string, limit?: number) =>
    request<import("@frota/shared").PositionDto[]>(
      `/positions/trail${qs({ vehicleId, limit: limit ? String(limit) : undefined })}`,
    ),
  getTimeline: (vehicleId: string, from?: string, to?: string) =>
    request<import("@frota/shared").TimelineReportDto>(
      `/positions/timeline${qs({ vehicleId, from, to })}`,
    ),
  reverseGeocode: (lat: number, lng: number) =>
    request<{ address: string | null }>(`/geocode/reverse${qs({ lat: String(lat), lng: String(lng) })}`),
  getVehicleLiveStatus: (vehicleId: string) =>
    request<import("@frota/shared").VehicleLiveStatusDto>(`/vehicles/${vehicleId}/live-status`),

  getAlerts: () => request<import("@frota/shared").AlertDto[]>("/alerts"),
  getAlertsInbox: (params?: {
    vehicleId?: string;
    type?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: string;
  }) =>
    request<import("@frota/shared").AlertDto[]>(
      `/alerts/inbox${qs({
        vehicleId: params?.vehicleId,
        type: params?.type,
        status: params?.status,
        from: params?.from,
        to: params?.to,
        limit: params?.limit,
      })}`,
    ),
  updateAlertStatus: (id: string, status: import("@frota/shared").AlertStatus) =>
    request<import("@frota/shared").AlertDto>(`/alerts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getVideoClips: (vehicleId?: string) =>
    request<import("@frota/shared").VideoClipDto[]>(`/video-clips${qs({ vehicleId })}`),
  startLiveStream: (vehicleId: string, channel = 1) =>
    request<import("@frota/shared").LiveStreamDto>(`/vehicles/${vehicleId}/live-stream`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    }),
  requestVideo: (vehicleId: string, startTime: string, durationSec = 60) =>
    request<{ ok: boolean; message: string }>(`/vehicles/${vehicleId}/request-video`, {
      method: "POST",
      body: JSON.stringify({ startTime, durationSec }),
    }),

  getFleetReport: (from?: string, to?: string) =>
    request<import("@frota/shared").FleetReportDto>(`/reports/fleet${qs({ from, to })}`),
  exportFleetReport: (format: "csv" | "pdf", from?: string, to?: string) =>
    download(`/export/reports/fleet${qs({ format, from, to })}`, `relatorio-frota.${format}`),
  exportAlerts: (format: "csv" | "pdf") =>
    download(`/export/alerts${qs({ format })}`, `alertas.${format}`),

  getGeofences: () => request<import("@frota/shared").GeofenceDto[]>("/geofences"),
  createGeofence: (body: import("@frota/shared").CreateGeofenceInput) =>
    request<import("@frota/shared").GeofenceDto>("/geofences", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteGeofence: (id: string) => request<void>(`/geofences/${id}`, { method: "DELETE" }),

  getFuelEntries: () => request<import("@frota/shared").FuelEntryDto[]>("/fuel-entries"),
  createFuelEntry: (body: import("@frota/shared").CreateFuelEntryInput) =>
    request<import("@frota/shared").FuelEntryDto>("/fuel-entries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getFuelStats: () =>
    request<{
      totalLiters: number;
      totalCost: number;
      byVehicle: Array<{ vehicleId: string; plate: string; liters: number; cost: number }>;
    }>("/fuel-entries/stats"),

  getMaintenanceOrders: () =>
    request<import("@frota/shared").MaintenanceOrderDto[]>("/maintenance/orders"),
  createMaintenanceOrder: (body: import("@frota/shared").CreateMaintenanceOrderInput) =>
    request<import("@frota/shared").MaintenanceOrderDto>("/maintenance/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMaintenanceReminders: () =>
    request<import("@frota/shared").MaintenanceReminderDto[]>("/maintenance/reminders"),
  createMaintenanceReminder: (body: import("@frota/shared").CreateMaintenanceReminderInput) =>
    request<import("@frota/shared").MaintenanceReminderDto>("/maintenance/reminders", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getChecklistTemplates: () =>
    request<import("@frota/shared").ChecklistTemplateDto[]>("/checklists/templates"),
  getChecklistEntries: () =>
    request<import("@frota/shared").ChecklistEntryDto[]>("/checklists/entries"),
  submitChecklist: (body: import("@frota/shared").SubmitChecklistInput) =>
    request<import("@frota/shared").ChecklistEntryDto>("/checklists/entries", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getFines: () => request<import("@frota/shared").VehicleFineDto[]>("/fines"),
  createFine: (body: import("@frota/shared").CreateVehicleFineInput) =>
    request<import("@frota/shared").VehicleFineDto>("/fines", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFineStatus: (id: string, status: import("@frota/shared").FineStatus) =>
    request<import("@frota/shared").VehicleFineDto>(`/fines/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, paidAt: status === "PAID" ? new Date().toISOString() : undefined }),
    }),

  getExpenses: () => request<import("@frota/shared").VehicleExpenseDto[]>("/expenses"),
  createExpense: (body: import("@frota/shared").CreateVehicleExpenseInput) =>
    request<import("@frota/shared").VehicleExpenseDto>("/expenses", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getDashboardKpis: () => request<import("@frota/shared").DashboardKpiDto>("/dashboard/kpis"),
  getDashboardLayout: () =>
    request<import("@frota/shared").DashboardWidget[]>("/dashboard/layout"),
  saveDashboardLayout: (widgets: import("@frota/shared").DashboardWidget[]) =>
    request<import("@frota/shared").DashboardWidget[]>("/dashboard/layout", {
      method: "PUT",
      body: JSON.stringify(widgets),
    }),
  getNotificationPrefs: () =>
    request<import("@frota/shared").NotificationPreferenceDto[]>("/notifications/preferences"),
  saveNotificationPrefs: (body: Partial<import("@frota/shared").NotificationPreferenceDto>) =>
    request<import("@frota/shared").NotificationPreferenceDto>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
