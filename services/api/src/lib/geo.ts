/** Haversine distance in km between two coordinates. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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

/** Check if point is inside circular geofence. */
export function isInsideGeofence(
  lat: number,
  lon: number,
  fenceLat: number,
  fenceLon: number,
  radiusMeters: number,
): boolean {
  return distanceKm(lat, lon, fenceLat, fenceLon) * 1000 <= radiusMeters;
}

export function alertSeverity(type: string): string {
  const map: Record<string, string> = {
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
  return map[type] ?? "MEDIUM";
}

export function computeDriverScore(stats: {
  dmsAlertCount: number;
  speedViolationCount: number;
  alertCount: number;
}): number {
  const penalty =
    stats.dmsAlertCount * 8 +
    stats.speedViolationCount * 3 +
    Math.max(0, stats.alertCount - stats.dmsAlertCount - stats.speedViolationCount) * 2;
  return Math.max(0, Math.min(100, 100 - penalty));
}
