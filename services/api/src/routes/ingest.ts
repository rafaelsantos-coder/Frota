import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  findVehicleByCameraGlobally,
  findVehicleByTrackerGlobally,
} from "./integrations.js";
import { toAlertDto, toPositionDto } from "../lib/mappers.js";
import { alertSeverity, isInsideGeofence } from "../lib/geo.js";

const gt06PositionSchema = z.object({
  imei: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  speedKmh: z.number().nullable().optional(),
  course: z.number().nullable().optional(),
  recordedAt: z.string().datetime(),
  remoteIp: z.string().optional(),
});

function verifyInternalSecret(header?: string) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return true;
  return header === expected;
}

async function checkGeofences(
  vehicleId: string,
  organizationId: string,
  lat: number,
  lng: number,
  speedKmh: number | null,
) {
  const fences = await prisma.geofence.findMany({
    where: { organizationId, enabled: true },
  });

  const speedLimit = Number(process.env.SPEED_LIMIT_KMH ?? 80);
  if (speedKmh != null && speedKmh > speedLimit) {
    await prisma.alert.create({
      data: {
        vehicleId,
        source: "GT06",
        type: "OVERSPEED",
        label: `Excesso de velocidade (${Math.round(speedKmh)} km/h)`,
        severity: alertSeverity("OVERSPEED"),
        payload: { speedKmh, limit: speedLimit },
      },
    });
  }

  for (const fence of fences) {
    const inside = isInsideGeofence(lat, lng, fence.latitude, fence.longitude, fence.radiusMeters);
    const key = `geofence:${fence.id}`;
    const lastAlert = await prisma.alert.findFirst({
      where: { vehicleId, type: { in: ["GEOFENCE_ENTER", "GEOFENCE_EXIT"] } },
      orderBy: { createdAt: "desc" },
    });
    const lastState = (lastAlert?.payload as { key?: string; inside?: boolean } | undefined)?.inside;

    if (inside && lastState !== true) {
      await prisma.alert.create({
        data: {
          vehicleId,
          source: "GT06",
          type: "GEOFENCE_ENTER",
          label: `Entrada em cerca: ${fence.name}`,
          severity: alertSeverity("GEOFENCE_ENTER"),
          payload: { key, inside: true, geofenceId: fence.id, geofenceName: fence.name },
        },
      });
    } else if (!inside && lastState === true) {
      await prisma.alert.create({
        data: {
          vehicleId,
          source: "GT06",
          type: "GEOFENCE_EXIT",
          label: `Saída de cerca: ${fence.name}`,
          severity: alertSeverity("GEOFENCE_EXIT"),
          payload: { key, inside: false, geofenceId: fence.id, geofenceName: fence.name },
        },
      });
    }
  }
}

async function handleFileUpload(body: Record<string, unknown>) {
  const rawList = body.data_list ?? body.dataList;
  let items: Array<Record<string, unknown>> = [];
  if (typeof rawList === "string") {
    try {
      items = JSON.parse(rawList) as Array<Record<string, unknown>>;
    } catch {
      items = [];
    }
  } else if (Array.isArray(rawList)) {
    items = rawList as Array<Record<string, unknown>>;
  }

  for (const item of items) {
    const deviceImei = String(item.deviceImei ?? item.imei ?? "");
    const result = String(item.result ?? "SUCCESS");
    if (result !== "SUCCESS" || !deviceImei) continue;

    const vehicle = await findVehicleByCameraGlobally(deviceImei);
    if (!vehicle) continue;

    const fileNames = String(item.fileName ?? "")
      .split(";")
      .map((f) => f.trim())
      .filter(Boolean);

    for (const fileName of fileNames) {
      const isVideo = fileName.endsWith(".mp4");
      const channelMatch = fileName.match(/_(\d)(\d)\.(mp4|jpg)$/);
      const channel = channelMatch ? channelMatch[1] : null;
      const gateTime = item.gateTime ? new Date(String(item.gateTime)) : new Date();

      const recentAlert = await prisma.alert.findFirst({
        where: { vehicleId: vehicle.id, source: "JIMI" },
        orderBy: { createdAt: "desc" },
      });

      const clip = await prisma.videoClip.create({
        data: {
          vehicleId: vehicle.id,
          alertId: recentAlert?.id ?? null,
          fileName,
          fileUrl: (item.fileUrl as string | undefined) ?? null,
          channel,
          recordedAt: gateTime,
        },
      });

      if (isVideo && recentAlert) {
        await prisma.alert.update({
          where: { id: recentAlert.id },
          data: { payload: { ...(recentAlert.payload as object), videoClipId: clip.id } },
        });
      }
    }
  }

  return { ok: true };
}

export async function registerIngestRoutes(app: FastifyInstance) {
  app.post("/internal/gt06/position", async (request, reply) => {
    if (!verifyInternalSecret(request.headers["x-internal-secret"] as string | undefined)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = gt06PositionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const imei = parsed.data.imei.replace(/\D/g, "");
    const vehicle = await findVehicleByTrackerGlobally(imei);

    await prisma.trackerSession.upsert({
      where: { imei },
      create: {
        imei,
        connected: true,
        lastSeenAt: new Date(parsed.data.recordedAt),
        remoteIp: parsed.data.remoteIp,
      },
      update: {
        connected: true,
        lastSeenAt: new Date(parsed.data.recordedAt),
        remoteIp: parsed.data.remoteIp,
      },
    });

    if (vehicle) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { trackerStatus: "ONLINE" },
      });

      const position = await prisma.position.create({
        data: {
          vehicleId: vehicle.id,
          source: "GT06",
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          speedKmh: parsed.data.speedKmh ?? null,
          course: parsed.data.course ?? null,
          recordedAt: new Date(parsed.data.recordedAt),
        },
      });

      void checkGeofences(
        vehicle.id,
        vehicle.organizationId,
        parsed.data.latitude,
        parsed.data.longitude,
        parsed.data.speedKmh ?? null,
      );

      return { ok: true, linked: true, position: toPositionDto(position) };
    }

    return { ok: true, linked: false, imei };
  });

  app.post("/internal/gt06/session", async (request, reply) => {
    if (!verifyInternalSecret(request.headers["x-internal-secret"] as string | undefined)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { imei: string; connected: boolean; remoteIp?: string };
    const imei = body.imei.replace(/\D/g, "");

    await prisma.trackerSession.upsert({
      where: { imei },
      create: {
        imei,
        connected: body.connected,
        lastSeenAt: new Date(),
        remoteIp: body.remoteIp,
      },
      update: {
        connected: body.connected,
        lastSeenAt: new Date(),
        remoteIp: body.remoteIp,
      },
    });

    const vehicle = await findVehicleByTrackerGlobally(imei);
    if (vehicle) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { trackerStatus: body.connected ? "ONLINE" : "OFFLINE" },
      });
    }

    return { ok: true };
  });
}

export async function registerJimiWebhookRoutes(app: FastifyInstance) {
  const handlePush = async (path: string, payload: unknown) => {
    app.log.info({ path }, "Jimi webhook received");

    const body = payload as Record<string, unknown>;

    if (path.includes("pushfileupload")) {
      return handleFileUpload(body);
    }

    const deviceId =
      (body.deviceImei as string | undefined) ??
      (body.imei as string | undefined) ??
      (body.deviceId as string | undefined);

    if (deviceId) {
      const vehicle = await findVehicleByCameraGlobally(String(deviceId));
      if (vehicle) {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { cameraStatus: "ONLINE" },
        });
      }
    }

    if (path.includes("pushgps") && deviceId) {
      const vehicle = await findVehicleByCameraGlobally(String(deviceId));
      const lat = Number(body.lat ?? body.latitude);
      const lng = Number(body.lng ?? body.longitude);
      if (vehicle && Number.isFinite(lat) && Number.isFinite(lng)) {
        const position = await prisma.position.create({
          data: {
            vehicleId: vehicle.id,
            source: "JIMI",
            latitude: lat,
            longitude: lng,
            speedKmh: body.speed != null ? Number(body.speed) : null,
            course: body.course != null ? Number(body.course) : null,
            recordedAt: new Date(String(body.gpsTime ?? body.time ?? new Date().toISOString())),
          },
        });
        return { ok: true, position: toPositionDto(position) };
      }
    }

    if (path.includes("pushalarm") && deviceId) {
      const vehicle = await findVehicleByCameraGlobally(String(deviceId));
      const alarmLabel = String(body.alarmLabel ?? body.alertType ?? "UNKNOWN");
      const alert = await prisma.alert.create({
        data: {
          vehicleId: vehicle?.id,
          source: "JIMI",
          type: alarmLabel,
          label: alarmLabel,
          severity: alertSeverity(alarmLabel),
          payload: body as object,
        },
      });
      return { ok: true, alert: toAlertDto(alert) };
    }

    return { ok: true };
  };

  for (const path of [
    "/integrations/jimi/pushgps",
    "/integrations/jimi/pushalarm",
    "/integrations/jimi/pushIothubEvent",
    "/integrations/jimi/pushfileupload",
    "/integrations/jimi/pushhb",
    "/integrations/jimi/pushevent",
  ]) {
    app.post(path, async (request) => handlePush(path, request.body));
  }
}

export async function registerTelemetryRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/positions/latest", auth, async (request) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: request.authUser!.organizationId },
    });
    const latest = await Promise.all(
      vehicles.map(async (vehicle) => {
        const position = await prisma.position.findFirst({
          where: { vehicleId: vehicle.id },
          orderBy: { recordedAt: "desc" },
        });
        return position
          ? {
              vehicle: {
                id: vehicle.id,
                plate: vehicle.plate,
                label: vehicle.label,
              },
              position: toPositionDto(position),
            }
          : null;
      }),
    );

    return latest.filter(Boolean);
  });

  app.get("/alerts", auth, async (request) => {
    const vehicleIds = (
      await prisma.vehicle.findMany({
        where: { organizationId: request.authUser!.organizationId },
        select: { id: true },
      })
    ).map((v) => v.id);

    const alerts = await prisma.alert.findMany({
      where: { OR: [{ vehicleId: { in: vehicleIds } }, { vehicleId: null }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        vehicle: { select: { id: true, plate: true, label: true } },
        videoClips: true,
      },
    });
    return alerts.map(toAlertDto);
  });
}
