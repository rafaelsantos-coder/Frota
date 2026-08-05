import type {
  AlertDto,
  GeofenceDto,
  Gt06IntegrationDto,
  JimiIntegrationDto,
  PositionDto,
  VehicleDto,
  VideoClipDto,
} from "@frota/shared";

export function toVehicleDto(vehicle: {
  id: string;
  plate: string;
  label: string;
  trackerImei: string | null;
  cameraDeviceId: string | null;
  cameraModel: string | null;
  trackerStatus: VehicleDto["trackerStatus"];
  cameraStatus: VehicleDto["cameraStatus"];
  createdAt: Date;
  updatedAt: Date;
}): VehicleDto {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    label: vehicle.label,
    trackerImei: vehicle.trackerImei,
    cameraDeviceId: vehicle.cameraDeviceId,
    cameraModel: vehicle.cameraModel as VehicleDto["cameraModel"],
    trackerStatus: vehicle.trackerStatus,
    cameraStatus: vehicle.cameraStatus,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export function toJimiIntegrationDto(integration: {
  id: string;
  label: string;
  appKey: string | null;
  appSecret: string | null;
  pushUrl: string | null;
  apiBaseUrl: string;
  enabled: boolean;
  updatedAt: Date;
}): JimiIntegrationDto {
  return {
    id: integration.id,
    label: integration.label,
    appKey: integration.appKey,
    appSecretConfigured: Boolean(integration.appSecret),
    pushUrl: integration.pushUrl,
    apiBaseUrl: integration.apiBaseUrl,
    enabled: integration.enabled,
    updatedAt: integration.updatedAt.toISOString(),
  };
}

export function toGt06IntegrationDto(integration: {
  id: string;
  label: string;
  host: string;
  port: number;
  enabled: boolean;
  updatedAt: Date;
}): Gt06IntegrationDto {
  return {
    id: integration.id,
    label: integration.label,
    host: integration.host,
    port: integration.port,
    enabled: integration.enabled,
    updatedAt: integration.updatedAt.toISOString(),
  };
}

export function toGeofenceDto(fence: {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): GeofenceDto {
  return {
    id: fence.id,
    name: fence.name,
    latitude: fence.latitude,
    longitude: fence.longitude,
    radiusMeters: fence.radiusMeters,
    enabled: fence.enabled,
    createdAt: fence.createdAt.toISOString(),
    updatedAt: fence.updatedAt.toISOString(),
  };
}

export function toPositionDto(position: {
  id: string;
  vehicleId: string;
  source: PositionDto["source"];
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  recordedAt: Date;
}): PositionDto {
  return {
    id: position.id,
    vehicleId: position.vehicleId,
    source: position.source,
    latitude: position.latitude,
    longitude: position.longitude,
    speedKmh: position.speedKmh,
    course: position.course,
    recordedAt: position.recordedAt.toISOString(),
  };
}

export function toVideoClipDto(clip: {
  id: string;
  vehicleId: string;
  alertId: string | null;
  fileName: string;
  fileUrl: string | null;
  channel: string | null;
  recordedAt: Date | null;
  createdAt: Date;
  vehicle?: { id: string; plate: string; label: string };
}): VideoClipDto {
  return {
    id: clip.id,
    vehicleId: clip.vehicleId,
    alertId: clip.alertId,
    fileName: clip.fileName,
    fileUrl: clip.fileUrl,
    channel: clip.channel,
    recordedAt: clip.recordedAt?.toISOString() ?? null,
    createdAt: clip.createdAt.toISOString(),
    vehicle: clip.vehicle,
  };
}

export function toAlertDto(alert: {
  id: string;
  vehicleId: string | null;
  source: AlertDto["source"];
  type: string;
  label: string;
  status: AlertDto["status"];
  severity: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: { id: string; plate: string; label: string } | null;
  videoClips?: Array<{
    id: string;
    vehicleId: string;
    alertId: string | null;
    fileName: string;
    fileUrl: string | null;
    channel: string | null;
    recordedAt: Date | null;
    createdAt: Date;
  }>;
}): AlertDto {
  return {
    id: alert.id,
    vehicleId: alert.vehicleId,
    source: alert.source,
    type: alert.type,
    label: alert.label,
    status: alert.status,
    severity: alert.severity,
    payload: alert.payload as Record<string, unknown>,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    vehicle: alert.vehicle ?? undefined,
    videoClips: alert.videoClips?.map((c) => toVideoClipDto(c)),
  };
}
