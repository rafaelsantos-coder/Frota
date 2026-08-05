const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
const internalSecret = process.env.INTERNAL_API_SECRET ?? "change-me-in-production";

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function notifySession(
  imei: string,
  connected: boolean,
  remoteIp?: string,
  ignitionOn?: boolean,
) {
  try {
    await postJson("/internal/gt06/session", { imei, connected, remoteIp, ignitionOn });
  } catch (error) {
    console.error("[gt06] session notify failed", error);
  }
}

export async function forwardPosition(input: {
  imei: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  recordedAt: Date;
  remoteIp?: string;
  ignitionOn?: boolean;
}) {
  try {
    await postJson("/internal/gt06/position", {
      imei: input.imei,
      latitude: input.latitude,
      longitude: input.longitude,
      speedKmh: input.speedKmh,
      course: input.course,
      recordedAt: input.recordedAt.toISOString(),
      remoteIp: input.remoteIp,
      ignitionOn: input.ignitionOn ?? null,
    });
  } catch (error) {
    console.error("[gt06] position forward failed", error);
  }
}

export async function forwardAlarm(input: {
  imei: string;
  alarmType: string;
  latitude?: number;
  longitude?: number;
  recordedAt?: Date;
}) {
  try {
    await postJson("/internal/gt06/alarm", {
      imei: input.imei,
      alarmType: input.alarmType,
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt: (input.recordedAt ?? new Date()).toISOString(),
    });
  } catch (error) {
    console.error("[gt06] alarm forward failed", error);
  }
}

export async function forwardRfid(input: { imei: string; rfidTag: string }) {
  try {
    await postJson("/internal/gt06/rfid", {
      imei: input.imei,
      rfidTag: input.rfidTag,
      recordedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[gt06] rfid forward failed", error);
  }
}
