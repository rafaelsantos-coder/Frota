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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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
  logout: () => {
    clearToken();
  },
  getVehicles: () => request<import("@frota/shared").VehicleDto[]>("/vehicles"),
  getVehicle: (id: string) => request<import("@frota/shared").VehicleDto>(`/vehicles/${id}`),
  createVehicle: (body: import("@frota/shared").CreateVehicleInput) =>
    request<import("@frota/shared").VehicleDto>("/vehicles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteVehicle: (id: string) => request<void>(`/vehicles/${id}`, { method: "DELETE" }),
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
    request<import("@frota/shared").VideoClipDto[]>(
      `/video-clips${qs({ vehicleId })}`,
    ),
  getFleetReport: (from?: string, to?: string) =>
    request<import("@frota/shared").FleetReportDto>(
      `/reports/fleet${qs({ from, to })}`,
    ),
  getGeofences: () => request<import("@frota/shared").GeofenceDto[]>("/geofences"),
  createGeofence: (body: import("@frota/shared").CreateGeofenceInput) =>
    request<import("@frota/shared").GeofenceDto>("/geofences", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteGeofence: (id: string) => request<void>(`/geofences/${id}`, { method: "DELETE" }),
};
