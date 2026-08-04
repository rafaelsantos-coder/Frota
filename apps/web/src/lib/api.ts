const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getVehicles: () => request<import("@frota/shared").VehicleDto[]>("/vehicles"),
  createVehicle: (body: import("@frota/shared").CreateVehicleInput) =>
    request<import("@frota/shared").VehicleDto>("/vehicles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteVehicle: (id: string) =>
    request<void>(`/vehicles/${id}`, { method: "DELETE" }),
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
  getAlerts: () => request<import("@frota/shared").AlertDto[]>("/alerts"),
};
