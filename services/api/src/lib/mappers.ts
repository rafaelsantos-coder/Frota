import type {
  AlertDto,
  Gt06IntegrationDto,
  JimiIntegrationDto,
  PositionDto,
  VehicleDto,
} from "@frota/shared";
import { prisma } from "./prisma.js";

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

export function toAlertDto(alert: {
  id: string;
  vehicleId: string | null;
  source: AlertDto["source"];
  type: string;
  label: string;
  payload: unknown;
  createdAt: Date;
}): AlertDto {
  return {
    id: alert.id,
    vehicleId: alert.vehicleId,
    source: alert.source,
    type: alert.type,
    label: alert.label,
    payload: alert.payload as Record<string, unknown>,
    createdAt: alert.createdAt.toISOString(),
  };
}
