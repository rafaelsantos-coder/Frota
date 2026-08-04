export type CameraModel = "JC371";

export type DeviceStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export interface VehicleDto {
  id: string;
  plate: string;
  label: string;
  trackerImei: string | null;
  cameraDeviceId: string | null;
  cameraModel: CameraModel | null;
  trackerStatus: DeviceStatus;
  cameraStatus: DeviceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JimiIntegrationDto {
  id: string;
  label: string;
  appKey: string | null;
  appSecretConfigured: boolean;
  pushUrl: string | null;
  apiBaseUrl: string;
  enabled: boolean;
  updatedAt: string;
}

export interface Gt06IntegrationDto {
  id: string;
  label: string;
  host: string;
  port: number;
  enabled: boolean;
  updatedAt: string;
}

export interface PositionDto {
  id: string;
  vehicleId: string;
  source: "GT06" | "JIMI";
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  recordedAt: string;
}

export interface AlertDto {
  id: string;
  vehicleId: string | null;
  source: "GT06" | "JIMI";
  type: string;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateVehicleInput {
  plate: string;
  label: string;
  trackerImei?: string;
  cameraDeviceId?: string;
  cameraModel?: CameraModel;
}

export interface UpdateVehicleInput {
  plate?: string;
  label?: string;
  trackerImei?: string | null;
  cameraDeviceId?: string | null;
  cameraModel?: CameraModel | null;
}

export interface UpsertJimiIntegrationInput {
  label?: string;
  appKey?: string | null;
  appSecret?: string | null;
  pushUrl?: string | null;
  apiBaseUrl?: string;
  enabled?: boolean;
}

export interface UpsertGt06IntegrationInput {
  label?: string;
  host?: string;
  port?: number;
  enabled?: boolean;
}

export const JIMI_DMS_EVENTS = [
  "SMOKING",
  "PHONECALLING",
  "DISTRACTION",
  "FATIGUE",
  "NOSEATBELT",
  "YAWNING",
  "EYESCLOSED",
] as const;

export const JIMI_ADAS_EVENTS = [
  "FRONTCollision",
  "LANEDEPARTURE",
  "VEHICLETOOCLOSE",
  "PEDESTRIAN",
] as const;
