export type UserRole = "ADMIN" | "OPERATOR";

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type CameraModel = "JC371";

export type DeviceStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export type AlertStatus = "NEW" | "REVIEWING" | "RESOLVED";

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

export interface VehicleWithPositionDto extends VehicleDto {
  position: PositionDto | null;
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

export interface GeofenceDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
  createdAt: string;
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
  status: AlertStatus;
  severity: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  vehicle?: { id: string; plate: string; label: string };
  videoClips?: VideoClipDto[];
}

export interface VideoClipDto {
  id: string;
  vehicleId: string;
  alertId: string | null;
  fileName: string;
  fileUrl: string | null;
  channel: string | null;
  recordedAt: string | null;
  createdAt: string;
  vehicle?: { id: string; plate: string; label: string };
}

export interface FleetReportVehicleDto {
  vehicleId: string;
  plate: string;
  label: string;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  stopCount: number;
  movingMinutes: number;
  alertCount: number;
  dmsAlertCount: number;
  speedViolationCount: number;
  score: number;
}

export interface FleetReportDto {
  from: string;
  to: string;
  speedLimitKmh: number;
  vehicles: FleetReportVehicleDto[];
  totals: {
    distanceKm: number;
    alertCount: number;
    dmsAlertCount: number;
    avgScore: number;
  };
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

export interface CreateGeofenceInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  enabled?: boolean;
}

export interface UpdateGeofenceInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
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

export const ALERT_SEVERITY: Record<string, string> = {
  SMOKING: "HIGH",
  PHONECALLING: "HIGH",
  DISTRACTION: "HIGH",
  FATIGUE: "CRITICAL",
  EYESCLOSED: "CRITICAL",
  FRONTCollision: "CRITICAL",
  LANEDEPARTURE: "HIGH",
  OVERSPEED: "MEDIUM",
  GEOFENCE_ENTER: "MEDIUM",
  GEOFENCE_EXIT: "MEDIUM",
};
