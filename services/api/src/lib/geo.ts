import { ALERT_SEVERITY } from "@frota/shared";

/** Haversine distance in km between two coordinates. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGeofence(
  lat: number,
  lon: number,
  fenceLat: number,
  fenceLon: number,
  radiusMeters: number,
): boolean {
  return distanceKm(lat, lon, fenceLat, fenceLon) * 1000 <= radiusMeters;
}

export type LatLngPoint = [number, number];

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon(lat: number, lon: number, polygon: LatLngPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]!;
    const [yj, xj] = polygon[j]!;
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: LatLngPoint[]): { lat: number; lon: number } {
  let lat = 0;
  let lon = 0;
  for (const [pLat, pLon] of polygon) {
    lat += pLat;
    lon += pLon;
  }
  return { lat: lat / polygon.length, lon: lon / polygon.length };
}

export function geofenceContains(
  lat: number,
  lon: number,
  fence: {
    type: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    polygon?: unknown;
  },
): boolean {
  if (fence.type === "POLYGON" && Array.isArray(fence.polygon)) {
    const points = fence.polygon.filter(
      (p): p is LatLngPoint =>
        Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number",
    );
    if (points.length >= 3) return isPointInPolygon(lat, lon, points);
  }
  return isInsideGeofence(lat, lon, fence.latitude, fence.longitude, fence.radiusMeters);
}

export function alertSeverity(type: string): string {
  return ALERT_SEVERITY[type] ?? "MEDIUM";
}

export function computeDriverScore(stats: {
  dmsAlertCount: number;
  speedViolationCount: number;
  alertCount: number;
  idleMinutes?: number;
}): number {
  const penalty =
    stats.dmsAlertCount * 8 +
    stats.speedViolationCount * 3 +
    Math.max(0, (stats.idleMinutes ?? 0) - 60) * 0.1 +
    Math.max(0, stats.alertCount - stats.dmsAlertCount - stats.speedViolationCount) * 2;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export type PositionPoint = {
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  course?: number | null;
  recordedAt: Date;
  ignitionOn?: boolean | null;
};

export function analyzeRoute(positions: PositionPoint[], speedLimit: number) {
  let distance = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let speedCount = 0;
  let stopCount = 0;
  let movingMinutes = 0;
  let idleMinutes = 0;
  let speedViolations = 0;
  let lowSpeedStreak = 0;
  let idleStreak = 0;

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    const speed = p.speedKmh ?? 0;
    if (speed > maxSpeed) maxSpeed = speed;
    if (speed > 0) {
      speedSum += speed;
      speedCount++;
    }
    if (speed > speedLimit) speedViolations++;

    if (i > 0) {
      const prev = positions[i - 1]!;
      distance += distanceKm(prev.latitude, prev.longitude, p.latitude, p.longitude);
      const dtMin = (p.recordedAt.getTime() - prev.recordedAt.getTime()) / 60000;
      if (speed > 5) movingMinutes += dtMin;
      if (speed <= 5) {
        lowSpeedStreak += dtMin;
        if (lowSpeedStreak >= 5 && (prev.speedKmh ?? 0) > 5) stopCount++;
      } else {
        lowSpeedStreak = 0;
      }
      const ignition = p.ignitionOn ?? prev.ignitionOn ?? false;
      if (ignition && speed <= 5) {
        idleStreak += dtMin;
      } else {
        idleStreak = 0;
      }
      if (idleStreak >= 3) idleMinutes += dtMin;
    }
  }

  return {
    distanceKm: Math.round(distance * 10) / 10,
    maxSpeedKmh: Math.round(maxSpeed),
    avgSpeedKmh: speedCount ? Math.round(speedSum / speedCount) : 0,
    stopCount,
    movingMinutes: Math.round(movingMinutes),
    idleMinutes: Math.round(idleMinutes),
    speedViolationCount: speedViolations,
  };
}

export function detectStopPoints(
  positions: PositionPoint[],
  minDurationMin = 5,
): Array<{ latitude: number; longitude: number; startedAt: Date; endedAt: Date; durationMin: number }> {
  const stops: Array<{
    latitude: number;
    longitude: number;
    startedAt: Date;
    endedAt: Date;
    durationMin: number;
  }> = [];
  let start: PositionPoint | null = null;
  let lastStopped: PositionPoint | null = null;

  for (const p of positions) {
    const stopped = (p.speedKmh ?? 0) <= 5;
    if (stopped) {
      if (!start) start = p;
      lastStopped = p;
    } else if (start && lastStopped) {
      const durationMin = (lastStopped.recordedAt.getTime() - start.recordedAt.getTime()) / 60000;
      if (durationMin >= minDurationMin) {
        stops.push({
          latitude: start.latitude,
          longitude: start.longitude,
          startedAt: start.recordedAt,
          endedAt: lastStopped.recordedAt,
          durationMin: Math.round(durationMin),
        });
      }
      start = null;
      lastStopped = null;
    }
  }

  return stops;
}

export function detectTelemetryEvents(
  positions: PositionPoint[],
): Array<{ type: string; label: string; latitude: number; longitude: number; recordedAt: Date }> {
  const events: Array<{
    type: string;
    label: string;
    latitude: number;
    longitude: number;
    recordedAt: Date;
  }> = [];

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1]!;
    const curr = positions[i]!;
    const dtSec = (curr.recordedAt.getTime() - prev.recordedAt.getTime()) / 1000;
    if (dtSec <= 0 || dtSec > 120) continue;

    const prevSpeed = prev.speedKmh ?? 0;
    const currSpeed = curr.speedKmh ?? 0;
    const decel = (prevSpeed - currSpeed) / dtSec;
    const accel = (currSpeed - prevSpeed) / dtSec;

    if (decel > 8 && prevSpeed > 20) {
      events.push({
        type: "HARD_BRAKE",
        label: "Frenagem brusca",
        latitude: curr.latitude,
        longitude: curr.longitude,
        recordedAt: curr.recordedAt,
      });
    }
    if (accel > 6 && currSpeed > 15) {
      events.push({
        type: "HARD_ACCEL",
        label: "Aceleração brusca",
        latitude: curr.latitude,
        longitude: curr.longitude,
        recordedAt: curr.recordedAt,
      });
    }
    if (Math.abs((curr.course ?? 0) - (prev.course ?? 0)) > 45 && currSpeed > 30) {
      events.push({
        type: "SHARP_TURN",
        label: "Curva acentuada",
        latitude: curr.latitude,
        longitude: curr.longitude,
        recordedAt: curr.recordedAt,
      });
    }
  }

  return events;
}

export function isReminderDueSoon(reminder: {
  intervalDays: number | null;
  intervalKm: number | null;
  lastDoneAt: Date | null;
  lastDoneKm: number | null;
  alertDaysBefore: number;
  currentKm?: number;
}): boolean {
  if (reminder.intervalDays && reminder.lastDoneAt) {
    const dueAt = new Date(reminder.lastDoneAt);
    dueAt.setDate(dueAt.getDate() + reminder.intervalDays);
    const warnAt = new Date(dueAt);
    warnAt.setDate(warnAt.getDate() - reminder.alertDaysBefore);
    if (new Date() >= warnAt) return true;
  }
  if (reminder.intervalKm && reminder.lastDoneKm != null && reminder.currentKm != null) {
    const remaining = reminder.intervalKm - (reminder.currentKm - reminder.lastDoneKm);
    if (remaining <= reminder.intervalKm * 0.1) return true;
  }
  return false;
}
