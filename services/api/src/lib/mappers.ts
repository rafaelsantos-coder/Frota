import type {
  AlertDto,
  ChecklistEntryDto,
  ChecklistTemplateDto,
  DriverDto,
  FuelEntryDto,
  GeofenceDto,
  Gt06IntegrationDto,
  JimiIntegrationDto,
  LiveStreamDto,
  MaintenanceOrderDto,
  MaintenanceReminderDto,
  PositionDto,
  StopPointDto,
  VehicleDto,
  VehicleExpenseDto,
  VehicleFineDto,
  VideoClipDto,
} from "@frota/shared";

export function toVehicleDto(vehicle: {
  id: string;
  plate: string;
  label: string;
  renavam?: string | null;
  plateState?: string | null;
  ownerDocument?: string | null;
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
    renavam: vehicle.renavam ?? null,
    plateState: vehicle.plateState ?? null,
    ownerDocument: vehicle.ownerDocument ?? null,
    trackerImei: vehicle.trackerImei,
    cameraDeviceId: vehicle.cameraDeviceId,
    cameraModel: vehicle.cameraModel as VehicleDto["cameraModel"],
    trackerStatus: vehicle.trackerStatus,
    cameraStatus: vehicle.cameraStatus,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export function toDriverDto(
  driver: {
    id: string;
    name: string;
    cpf: string | null;
    cnh: string | null;
    rfidTag: string | null;
    ibuttonId: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  currentVehicle?: { id: string; plate: string; label: string } | null,
): DriverDto {
  return {
    id: driver.id,
    name: driver.name,
    cpf: driver.cpf,
    cnh: driver.cnh,
    rfidTag: driver.rfidTag,
    ibuttonId: driver.ibuttonId,
    active: driver.active,
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
    currentVehicle: currentVehicle ?? null,
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
  type: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygon: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): GeofenceDto {
  const polygon = Array.isArray(fence.polygon)
    ? (fence.polygon as Array<[number, number]>)
    : null;
  return {
    id: fence.id,
    name: fence.name,
    type: fence.type === "POLYGON" ? "POLYGON" : "CIRCLE",
    latitude: fence.latitude,
    longitude: fence.longitude,
    radiusMeters: fence.radiusMeters,
    polygon,
    enabled: fence.enabled,
    createdAt: fence.createdAt.toISOString(),
    updatedAt: fence.updatedAt.toISOString(),
  };
}

export function toPositionDto(position: {
  id: string;
  vehicleId: string;
  driverId?: string | null;
  source: PositionDto["source"];
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  ignitionOn?: boolean | null;
  recordedAt: Date;
}): PositionDto {
  return {
    id: position.id,
    vehicleId: position.vehicleId,
    driverId: position.driverId ?? null,
    source: position.source,
    latitude: position.latitude,
    longitude: position.longitude,
    speedKmh: position.speedKmh,
    course: position.course,
    ignitionOn: position.ignitionOn ?? null,
    recordedAt: position.recordedAt.toISOString(),
  };
}

export function toStopPointDto(stop: {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  startedAt: Date;
  endedAt: Date | null;
  durationMin: number;
}): StopPointDto {
  return {
    id: stop.id,
    vehicleId: stop.vehicleId,
    latitude: stop.latitude,
    longitude: stop.longitude,
    startedAt: stop.startedAt.toISOString(),
    endedAt: stop.endedAt?.toISOString() ?? null,
    durationMin: stop.durationMin,
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

export function toLiveStreamDto(session: {
  id: string;
  vehicleId: string;
  streamUrl: string | null;
  channel: number;
  startedAt: Date;
  expiresAt: Date;
}): LiveStreamDto {
  const now = Date.now();
  const status =
    session.expiresAt.getTime() < now
      ? "EXPIRED"
      : session.streamUrl
        ? "ACTIVE"
        : "PENDING";
  return {
    id: session.id,
    vehicleId: session.vehicleId,
    streamUrl: session.streamUrl,
    channel: session.channel,
    startedAt: session.startedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    status,
  };
}

export function toAlertDto(alert: {
  id: string;
  vehicleId: string | null;
  driverId?: string | null;
  source: AlertDto["source"];
  type: string;
  label: string;
  status: AlertDto["status"];
  severity: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: { id: string; plate: string; label: string } | null;
  driver?: { id: string; name: string } | null;
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
    driverId: alert.driverId ?? null,
    source: alert.source,
    type: alert.type,
    label: alert.label,
    status: alert.status,
    severity: alert.severity,
    payload: alert.payload as Record<string, unknown>,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    vehicle: alert.vehicle ?? undefined,
    driver: alert.driver ?? undefined,
    videoClips: alert.videoClips?.map((c) => toVideoClipDto(c)),
  };
}

export function toFuelEntryDto(entry: {
  id: string;
  vehicleId: string;
  driverId: string | null;
  liters: number;
  amountPaid: number;
  odometerKm: number | null;
  station: string | null;
  recordedAt: Date;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string } | null;
}): FuelEntryDto {
  return {
    id: entry.id,
    vehicleId: entry.vehicleId,
    driverId: entry.driverId,
    liters: entry.liters,
    amountPaid: entry.amountPaid,
    odometerKm: entry.odometerKm,
    station: entry.station,
    recordedAt: entry.recordedAt.toISOString(),
    vehicle: entry.vehicle,
    driver: entry.driver ?? undefined,
  };
}

export function toMaintenanceOrderDto(order: {
  id: string;
  vehicleId: string;
  type: MaintenanceOrderDto["type"];
  description: string;
  partsCost: number;
  laborCost: number;
  odometerKm: number | null;
  performedAt: Date;
  notes: string | null;
  vehicle?: { id: string; plate: string; label: string };
}): MaintenanceOrderDto {
  return {
    id: order.id,
    vehicleId: order.vehicleId,
    type: order.type,
    description: order.description,
    partsCost: order.partsCost,
    laborCost: order.laborCost,
    odometerKm: order.odometerKm,
    performedAt: order.performedAt.toISOString(),
    notes: order.notes,
    vehicle: order.vehicle,
  };
}

export function toMaintenanceReminderDto(
  reminder: {
    id: string;
    vehicleId: string;
    service: string;
    intervalKm: number | null;
    intervalDays: number | null;
    lastDoneAt: Date | null;
    lastDoneKm: number | null;
    alertDaysBefore: number;
    enabled: boolean;
    vehicle?: { id: string; plate: string; label: string };
  },
  dueSoon: boolean,
): MaintenanceReminderDto {
  return {
    id: reminder.id,
    vehicleId: reminder.vehicleId,
    service: reminder.service,
    intervalKm: reminder.intervalKm,
    intervalDays: reminder.intervalDays,
    lastDoneAt: reminder.lastDoneAt?.toISOString() ?? null,
    lastDoneKm: reminder.lastDoneKm,
    alertDaysBefore: reminder.alertDaysBefore,
    enabled: reminder.enabled,
    dueSoon,
    vehicle: reminder.vehicle,
  };
}

export function toChecklistTemplateDto(template: {
  id: string;
  name: string;
  items: unknown;
  active: boolean;
  createdAt: Date;
}): ChecklistTemplateDto {
  return {
    id: template.id,
    name: template.name,
    items: template.items as ChecklistTemplateDto["items"],
    active: template.active,
    createdAt: template.createdAt.toISOString(),
  };
}

export function toChecklistEntryDto(entry: {
  id: string;
  vehicleId: string;
  driverId: string | null;
  templateId: string;
  answers: unknown;
  submittedAt: Date;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string } | null;
  template?: { id: string; name: string };
}): ChecklistEntryDto {
  return {
    id: entry.id,
    vehicleId: entry.vehicleId,
    driverId: entry.driverId,
    templateId: entry.templateId,
    answers: entry.answers as Record<string, boolean | string>,
    submittedAt: entry.submittedAt.toISOString(),
    vehicle: entry.vehicle,
    driver: entry.driver ?? undefined,
    template: entry.template,
  };
}

export function toVehicleFineDto(fine: {
  id: string;
  vehicleId: string;
  driverId: string | null;
  description: string;
  amount: number;
  dueDate: Date | null;
  paidAt: Date | null;
  status: VehicleFineDto["status"];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  autoImported: boolean;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string } | null;
}): VehicleFineDto {
  return {
    id: fine.id,
    vehicleId: fine.vehicleId,
    driverId: fine.driverId,
    description: fine.description,
    amount: fine.amount,
    dueDate: fine.dueDate?.toISOString() ?? null,
    paidAt: fine.paidAt?.toISOString() ?? null,
    status: fine.status,
    location: fine.location,
    latitude: fine.latitude,
    longitude: fine.longitude,
    autoImported: fine.autoImported,
    vehicle: fine.vehicle,
    driver: fine.driver ?? undefined,
  };
}

export function toVehicleExpenseDto(expense: {
  id: string;
  vehicleId: string;
  category: VehicleExpenseDto["category"];
  description: string;
  amount: number;
  dueDate: Date | null;
  paidAt: Date | null;
  vehicle?: { id: string; plate: string; label: string };
}): VehicleExpenseDto {
  return {
    id: expense.id,
    vehicleId: expense.vehicleId,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    dueDate: expense.dueDate?.toISOString() ?? null,
    paidAt: expense.paidAt?.toISOString() ?? null,
    vehicle: expense.vehicle,
  };
}
