export type UserRole = "ADMIN" | "OPERATOR";

export const PERMISSIONS = [
  "monitoring.view",
  "vehicles.view",
  "vehicles.manage",
  "drivers.view",
  "drivers.manage",
  "operations.view",
  "operations.manage",
  "reports.view",
  "integrations.manage",
  "admin.users",
  "admin.profiles",
  "admin.logs",
  "admin.vehicles",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "monitoring.view": "Monitoramento e histórico",
  "vehicles.view": "Visualizar veículos",
  "vehicles.manage": "Gerenciar veículos",
  "drivers.view": "Visualizar motoristas",
  "drivers.manage": "Gerenciar motoristas",
  "operations.view": "Operações (combustível, multas…)",
  "operations.manage": "Editar operações",
  "reports.view": "Relatórios",
  "integrations.manage": "Integrações GT06/Jimi",
  "admin.users": "Usuários",
  "admin.profiles": "Perfis de acesso",
  "admin.logs": "Log do sistema",
  "admin.vehicles": "Configuração de veículos",
};

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active?: boolean;
  profileId: string | null;
  profileName: string | null;
  organizationId: string;
  organizationName: string;
}

export interface AccessProfileDto {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDto {
  id: string;
  userEmail: string | null;
  userName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  profileId?: string | null;
  active?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  profileId?: string | null;
  active?: boolean;
}

export interface CreateAccessProfileInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface UpdateAccessProfileInput {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
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

export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE";

export type ExpenseCategory =
  | "IPVA"
  | "INSURANCE"
  | "LICENSE"
  | "RENT"
  | "FINANCING"
  | "TRAVEL"
  | "DOCUMENT"
  | "OTHER";

export type FineStatus = "PENDING" | "PAID" | "CONTESTED";

export interface VehicleDto {
  id: string;
  plate: string;
  label: string;
  renavam: string | null;
  plateState: string | null;
  ownerDocument: string | null;
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

export interface DriverDto {
  id: string;
  name: string;
  cpf: string | null;
  rg: string | null;
  cnh: string | null;
  birthDate: string | null;
  cnhExpiry: string | null;
  photoUrl: string | null;
  rfidTag: string | null;
  ibuttonId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentVehicle?: { id: string; plate: string; label: string } | null;
}

export interface CnhExtractResult {
  name?: string;
  cpf?: string;
  rg?: string;
  cnh?: string;
  birthDate?: string;
  cnhExpiry?: string;
  message?: string;
}

export interface DriverReportDto {
  driverId: string;
  name: string;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  alertCount: number;
  dmsAlertCount: number;
  speedViolationCount: number;
  idleMinutes: number;
  score: number;
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
  type: "CIRCLE" | "POLYGON";
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygon: Array<[number, number]> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionDto {
  id: string;
  vehicleId: string;
  driverId: string | null;
  source: "GT06" | "JIMI";
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course: number | null;
  ignitionOn: boolean | null;
  recordedAt: string;
}

export interface StopPointDto {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string | null;
  durationMin: number;
}

export interface RouteEventDto {
  id: string;
  type: string;
  label: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  severity: string;
}

export type TimelineSegmentType = "MOVING" | "STOPPED" | "OFFLINE" | "NO_SIGNAL";

export interface TimelineSegmentDto {
  type: TimelineSegmentType;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  distanceKm: number;
  maxSpeedKmh: number;
}

export interface TimelineReportDto {
  segments: TimelineSegmentDto[];
  totals: Record<TimelineSegmentType, number>;
  summary: { distanceKm: number; maxSpeedKmh: number };
}

export interface VehicleLiveStatusDto {
  gpsStatus: "OK" | "NO_SIGNAL" | "UNKNOWN";
  commStatus: "ONLINE" | "OFFLINE" | "UNKNOWN";
  motionStatus: "MOVING" | "STOPPED" | "UNKNOWN";
  ignitionOn: boolean | null;
  speedKmh: number | null;
  lastPositionAt: string | null;
  lastSeenAt: string | null;
  ageMin: number | null;
  address?: string | null;
}

export interface MapLayerOptions {
  showTrail: boolean;
  connectPoints: boolean;
  showGeofences: boolean;
  showAddress: boolean;
}

export const DEFAULT_MAP_LAYERS: MapLayerOptions = {
  showTrail: true,
  connectPoints: true,
  showGeofences: true,
  showAddress: false,
};

export const TIMELINE_COLORS: Record<TimelineSegmentType, string> = {
  MOVING: "#22c55e",
  STOPPED: "#f59e0b",
  OFFLINE: "#ef4444",
  NO_SIGNAL: "#94a3b8",
};

export const TIMELINE_LABELS: Record<TimelineSegmentType, string> = {
  MOVING: "Em movimento",
  STOPPED: "Parado",
  OFFLINE: "Sem comunicação",
  NO_SIGNAL: "Sem GPS",
};

export interface AlertDto {
  id: string;
  vehicleId: string | null;
  driverId: string | null;
  source: "GT06" | "JIMI";
  type: string;
  label: string;
  status: AlertStatus;
  severity: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string };
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

export interface LiveStreamDto {
  id: string;
  vehicleId: string;
  streamUrl: string | null;
  channel: number;
  startedAt: string;
  expiresAt: string;
  status: "ACTIVE" | "PENDING" | "EXPIRED";
}

export interface FuelEntryDto {
  id: string;
  vehicleId: string;
  driverId: string | null;
  liters: number;
  amountPaid: number;
  odometerKm: number | null;
  station: string | null;
  recordedAt: string;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string };
}

export interface MaintenanceOrderDto {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  partsCost: number;
  laborCost: number;
  odometerKm: number | null;
  performedAt: string;
  notes: string | null;
  vehicle?: { id: string; plate: string; label: string };
}

export interface MaintenanceReminderDto {
  id: string;
  vehicleId: string;
  service: string;
  intervalKm: number | null;
  intervalDays: number | null;
  lastDoneAt: string | null;
  lastDoneKm: number | null;
  alertDaysBefore: number;
  enabled: boolean;
  dueSoon: boolean;
  vehicle?: { id: string; plate: string; label: string };
}

export interface ChecklistTemplateDto {
  id: string;
  name: string;
  items: Array<{ label: string; required: boolean }>;
  active: boolean;
  createdAt: string;
}

export interface ChecklistEntryDto {
  id: string;
  vehicleId: string;
  driverId: string | null;
  templateId: string;
  answers: Record<string, boolean | string>;
  submittedAt: string;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string };
  template?: { id: string; name: string };
}

export interface VehicleFineDto {
  id: string;
  vehicleId: string;
  driverId: string | null;
  description: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  status: FineStatus;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  autoImported: boolean;
  vehicle?: { id: string; plate: string; label: string };
  driver?: { id: string; name: string };
}

export interface VehicleExpenseDto {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
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
  idleMinutes: number;
  alertCount: number;
  dmsAlertCount: number;
  speedViolationCount: number;
  score: number;
  fuelCost: number;
  maintenanceCost: number;
  fineCost: number;
  costPerKm: number;
}

export interface FleetReportDto {
  from: string;
  to: string;
  speedLimitKmh: number;
  vehicles: FleetReportVehicleDto[];
  drivers: DriverReportDto[];
  totals: {
    distanceKm: number;
    alertCount: number;
    dmsAlertCount: number;
    avgScore: number;
    fuelCost: number;
    maintenanceCost: number;
    fineCost: number;
    totalCost: number;
    costPerKm: number;
  };
}

export interface DashboardKpiDto {
  vehicles: number;
  drivers: number;
  onlineTrackers: number;
  criticalAlerts: number;
  distanceKm7d: number;
  avgScore: number;
  fuelCostMonth: number;
  maintenanceDue: number;
  pendingFines: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  visible: boolean;
  order: number;
}

export interface NotificationPreferenceDto {
  id: string;
  email: string | null;
  telegramChatId: string | null;
  onCritical: boolean;
  onHigh: boolean;
  onTelegram: boolean;
}

export interface ShareLinkDto {
  id: string;
  vehicleId: string;
  token: string;
  url: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

export interface PublicTrackDto {
  label: string;
  plate: string;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  recordedAt: string | null;
  commStatus: "ONLINE" | "OFFLINE" | "UNKNOWN";
  expiresAt: string;
}

export interface DeviceCommandDto {
  id: string;
  vehicleId: string;
  imei: string;
  type: "BLOCK" | "UNBLOCK";
  status: "PENDING" | "SENT" | "FAILED" | "ACKNOWLEDGED";
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface CreateVehicleInput {
  plate: string;
  label: string;
  renavam?: string;
  plateState?: string;
  ownerDocument?: string;
  trackerImei?: string;
  cameraDeviceId?: string;
  cameraModel?: CameraModel;
}

export interface UpdateVehicleInput {
  plate?: string;
  label?: string;
  renavam?: string | null;
  plateState?: string | null;
  ownerDocument?: string | null;
  trackerImei?: string | null;
  cameraDeviceId?: string | null;
  cameraModel?: CameraModel | null;
}

export interface CreateDriverInput {
  name: string;
  cpf?: string;
  rg?: string;
  cnh?: string;
  birthDate?: string;
  cnhExpiry?: string;
  photoData?: string;
  rfidTag?: string;
  ibuttonId?: string;
}

export interface UpdateDriverInput {
  name?: string;
  cpf?: string | null;
  rg?: string | null;
  cnh?: string | null;
  birthDate?: string | null;
  cnhExpiry?: string | null;
  photoData?: string | null;
  rfidTag?: string | null;
  ibuttonId?: string | null;
  active?: boolean;
}

export interface CreateFuelEntryInput {
  vehicleId: string;
  driverId?: string;
  liters: number;
  amountPaid: number;
  odometerKm?: number;
  station?: string;
  recordedAt: string;
}

export interface CreateMaintenanceOrderInput {
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  partsCost?: number;
  laborCost?: number;
  odometerKm?: number;
  performedAt: string;
  notes?: string;
}

export interface CreateMaintenanceReminderInput {
  vehicleId: string;
  service: string;
  intervalKm?: number;
  intervalDays?: number;
  lastDoneAt?: string;
  lastDoneKm?: number;
  alertDaysBefore?: number;
}

export interface CreateChecklistTemplateInput {
  name: string;
  items: Array<{ label: string; required: boolean }>;
}

export interface SubmitChecklistInput {
  vehicleId: string;
  driverId?: string;
  templateId: string;
  answers: Record<string, boolean | string>;
}

export interface CreateVehicleFineInput {
  vehicleId: string;
  driverId?: string;
  description: string;
  amount: number;
  dueDate?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateVehicleExpenseInput {
  vehicleId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  dueDate?: string;
  paidAt?: string;
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
  type?: "CIRCLE" | "POLYGON";
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  polygon?: Array<[number, number]>;
  enabled?: boolean;
}

export interface UpdateGeofenceInput {
  name?: string;
  type?: "CIRCLE" | "POLYGON";
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  polygon?: Array<[number, number]> | null;
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

export const TELEMETRY_EVENTS = [
  "HARD_BRAKE",
  "HARD_ACCEL",
  "SHARP_TURN",
  "ENGINE_IDLE",
  "OVERSPEED",
] as const;

export const ALERT_SEVERITY: Record<string, string> = {
  SMOKING: "HIGH",
  PHONECALLING: "HIGH",
  DISTRACTION: "HIGH",
  FATIGUE: "CRITICAL",
  EYESCLOSED: "CRITICAL",
  FRONTCollision: "CRITICAL",
  LANEDEPARTURE: "HIGH",
  HARD_BRAKE: "MEDIUM",
  HARD_ACCEL: "MEDIUM",
  SHARP_TURN: "MEDIUM",
  ENGINE_IDLE: "LOW",
  OVERSPEED: "MEDIUM",
  GEOFENCE_ENTER: "MEDIUM",
  GEOFENCE_EXIT: "MEDIUM",
};

export const DEFAULT_CHECKLIST_ITEMS = [
  { label: "Documentação do veículo regularizada", required: true },
  { label: "Pneus em bom estado", required: true },
  { label: "Extintor dentro da validade", required: true },
  { label: "Cinto de segurança funcionando", required: true },
  { label: "Luzes e setas OK", required: true },
  { label: "Retrovisores ajustados", required: false },
  { label: "Sem avarias visíveis na carroceria", required: false },
];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: "vehicles", type: "vehicles", visible: true, order: 0 },
  { id: "online", type: "online", visible: true, order: 1 },
  { id: "alerts", type: "alerts", visible: true, order: 2 },
  { id: "distance", type: "distance", visible: true, order: 3 },
  { id: "score", type: "score", visible: true, order: 4 },
  { id: "fuel", type: "fuel", visible: true, order: 5 },
  { id: "maintenance", type: "maintenance", visible: true, order: 6 },
  { id: "fines", type: "fines", visible: true, order: 7 },
];
