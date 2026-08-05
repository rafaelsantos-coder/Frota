import { distanceKm } from "./geo.js";

export type TimelineSegmentType = "MOVING" | "STOPPED" | "OFFLINE" | "NO_SIGNAL";

export type TimelineSegment = {
  type: TimelineSegmentType;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  distanceKm: number;
  maxSpeedKmh: number;
};

type Point = {
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  recordedAt: Date;
  ignitionOn?: boolean | null;
};

const OFFLINE_GAP_MIN = 15;
const MOVING_THRESHOLD = 5;

export function buildTimeline(positions: Point[]): {
  segments: TimelineSegment[];
  totals: Record<TimelineSegmentType, number>;
  summary: { distanceKm: number; maxSpeedKmh: number };
} {
  if (positions.length === 0) {
    return {
      segments: [],
      totals: { MOVING: 0, STOPPED: 0, OFFLINE: 0, NO_SIGNAL: 0 },
      summary: { distanceKm: 0, maxSpeedKmh: 0 },
    };
  }

  const segments: TimelineSegment[] = [];
  const totals: Record<TimelineSegmentType, number> = {
    MOVING: 0,
    STOPPED: 0,
    OFFLINE: 0,
    NO_SIGNAL: 0,
  };

  let totalDistance = 0;
  let maxSpeed = 0;

  function pushSegment(
    type: TimelineSegmentType,
    start: Date,
    end: Date,
    dist = 0,
    segMaxSpeed = 0,
  ) {
    const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    if (durationMin < 1 && type !== "OFFLINE") return;
    segments.push({
      type,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      durationMin,
      distanceKm: Math.round(dist * 10) / 10,
      maxSpeedKmh: Math.round(segMaxSpeed),
    });
    totals[type] += durationMin;
  }

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    const speed = p.speedKmh ?? 0;
    if (speed > maxSpeed) maxSpeed = speed;

    if (i > 0) {
      const prev = positions[i - 1]!;
      const gapMin = (p.recordedAt.getTime() - prev.recordedAt.getTime()) / 60000;
      const dist = distanceKm(prev.latitude, prev.longitude, p.latitude, p.longitude);
      totalDistance += dist;

      if (gapMin >= OFFLINE_GAP_MIN) {
        pushSegment("OFFLINE", prev.recordedAt, p.recordedAt);
      }

      const type: TimelineSegmentType = speed > MOVING_THRESHOLD ? "MOVING" : "STOPPED";
      const segStart = prev.recordedAt;
      const segEnd = p.recordedAt;
      const last = segments[segments.length - 1];
      if (last && last.type === type && new Date(last.endedAt).getTime() === segStart.getTime()) {
        last.endedAt = segEnd.toISOString();
        last.durationMin = Math.round((segEnd.getTime() - new Date(last.startedAt).getTime()) / 60000);
        last.distanceKm = Math.round((last.distanceKm + dist) * 10) / 10;
        last.maxSpeedKmh = Math.max(last.maxSpeedKmh, Math.round(speed));
        totals[type] += Math.round(gapMin);
      } else {
        pushSegment(type, segStart, segEnd, dist, speed);
      }
    }
  }

  return {
    segments,
    totals,
    summary: {
      distanceKm: Math.round(totalDistance * 10) / 10,
      maxSpeedKmh: Math.round(maxSpeed),
    },
  };
}

export function vehicleLiveStatus(input: {
  trackerStatus: string;
  lastPositionAt: Date | null;
  speedKmh: number | null;
  ignitionOn: boolean | null;
  sessionConnected: boolean | null;
  sessionLastSeen: Date | null;
}) {
  const now = Date.now();
  const lastAt = input.lastPositionAt?.getTime() ?? 0;
  const ageMin = lastAt ? (now - lastAt) / 60000 : null;

  let gpsStatus: "OK" | "NO_SIGNAL" | "UNKNOWN" = "UNKNOWN";
  if (ageMin != null) {
    gpsStatus = ageMin <= 10 ? "OK" : ageMin <= 30 ? "NO_SIGNAL" : "NO_SIGNAL";
  }

  let commStatus: "ONLINE" | "OFFLINE" | "UNKNOWN" = "UNKNOWN";
  if (input.sessionConnected != null) {
    commStatus = input.sessionConnected ? "ONLINE" : "OFFLINE";
  } else if (ageMin != null) {
    commStatus = ageMin <= 15 ? "ONLINE" : "OFFLINE";
  }

  const motionStatus =
    input.speedKmh != null
      ? input.speedKmh > MOVING_THRESHOLD
        ? "MOVING"
        : "STOPPED"
      : "UNKNOWN";

  return {
    gpsStatus,
    commStatus,
    motionStatus,
    ignitionOn: input.ignitionOn,
    speedKmh: input.speedKmh,
    lastPositionAt: input.lastPositionAt?.toISOString() ?? null,
    lastSeenAt: input.sessionLastSeen?.toISOString() ?? input.lastPositionAt?.toISOString() ?? null,
    ageMin: ageMin != null ? Math.round(ageMin) : null,
  };
}
