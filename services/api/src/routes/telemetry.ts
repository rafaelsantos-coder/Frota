import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  toAlertDto,
  toGeofenceDto,
  toPositionDto,
  toVehicleDto,
  toVideoClipDto,
} from "../lib/mappers.js";
import { alertSeverity, computeDriverScore, distanceKm } from "../lib/geo.js";
import { JIMI_DMS_EVENTS } from "@frota/shared";

const dmsSet = new Set<string>(JIMI_DMS_EVENTS);

async function orgVehicleIds(organizationId: string) {
  return (
    await prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((v) => v.id);
}

export async function registerExtendedTelemetryRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/positions/live", auth, async (request) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: request.authUser!.organizationId },
      orderBy: { label: "asc" },
    });

    const result = await Promise.all(
      vehicles.map(async (vehicle) => {
        const position = await prisma.position.findFirst({
          where: { vehicleId: vehicle.id },
          orderBy: { recordedAt: "desc" },
        });
        return {
          vehicle: toVehicleDto(vehicle),
          position: position ? toPositionDto(position) : null,
        };
      }),
    );

    return result;
  });

  app.get<{ Querystring: { vehicleId?: string; from?: string; to?: string; limit?: string } }>(
    "/positions/history",
    auth,
    async (request, reply) => {
      const orgId = request.authUser!.organizationId;
      const vehicleId = request.query.vehicleId;
      if (!vehicleId) {
        return reply.status(400).send({ error: "vehicleId é obrigatório" });
      }

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: orgId },
      });
      if (!vehicle) {
        return reply.status(404).send({ error: "Veículo não encontrado" });
      }

      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      const limit = Math.min(Number(request.query.limit ?? 2000), 5000);

      const positions = await prisma.position.findMany({
        where: {
          vehicleId,
          recordedAt: { gte: from, lte: to },
        },
        orderBy: { recordedAt: "asc" },
        take: limit,
      });

      return positions.map(toPositionDto);
    },
  );

  app.get<{
    Querystring: {
      vehicleId?: string;
      type?: string;
      status?: string;
      from?: string;
      to?: string;
      limit?: string;
    };
  }>("/alerts/inbox", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const where: Record<string, unknown> = {
      OR: [{ vehicleId: { in: vehicleIds } }, { vehicleId: null }],
    };

    if (request.query.vehicleId) where.vehicleId = request.query.vehicleId;
    if (request.query.type) where.type = request.query.type;
    if (request.query.status) where.status = request.query.status;
    if (request.query.from || request.query.to) {
      where.createdAt = {
        ...(request.query.from ? { gte: new Date(request.query.from) } : {}),
        ...(request.query.to ? { lte: new Date(request.query.to) } : {}),
      };
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(request.query.limit ?? 200), 500),
      include: {
        vehicle: { select: { id: true, plate: true, label: true } },
        videoClips: true,
      },
    });

    return alerts.map(toAlertDto);
  });

  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    "/alerts/:id/status",
    auth,
    async (request, reply) => {
      const schema = z.object({
        status: z.enum(["NEW", "REVIEWING", "RESOLVED"]),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
      const alert = await prisma.alert.findFirst({
        where: {
          id: request.params.id,
          OR: [{ vehicleId: { in: vehicleIds } }, { vehicleId: null }],
        },
      });
      if (!alert) {
        return reply.status(404).send({ error: "Alerta não encontrado" });
      }

      const updated = await prisma.alert.update({
        where: { id: alert.id },
        data: { status: parsed.data.status },
        include: {
          vehicle: { select: { id: true, plate: true, label: true } },
          videoClips: true,
        },
      });

      return toAlertDto(updated);
    },
  );

  app.get<{ Querystring: { vehicleId?: string; limit?: string } }>(
    "/video-clips",
    auth,
    async (request) => {
      const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
      const where: Record<string, unknown> = { vehicleId: { in: vehicleIds } };
      if (request.query.vehicleId) where.vehicleId = request.query.vehicleId;

      const clips = await prisma.videoClip.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(Number(request.query.limit ?? 100), 200),
        include: { vehicle: { select: { id: true, plate: true, label: true } } },
      });

      return clips.map(toVideoClipDto);
    },
  );

  app.get<{ Querystring: { from?: string; to?: string; speedLimit?: string } }>(
    "/reports/fleet",
    auth,
    async (request) => {
      const orgId = request.authUser!.organizationId;
      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      const speedLimit = Number(request.query.speedLimit ?? process.env.SPEED_LIMIT_KMH ?? 80);

      const vehicles = await prisma.vehicle.findMany({ where: { organizationId: orgId } });
      const reports = [];

      for (const vehicle of vehicles) {
        const positions = await prisma.position.findMany({
          where: { vehicleId: vehicle.id, recordedAt: { gte: from, lte: to } },
          orderBy: { recordedAt: "asc" },
        });

        let distance = 0;
        let maxSpeed = 0;
        let speedSum = 0;
        let speedCount = 0;
        let stopCount = 0;
        let movingMinutes = 0;
        let speedViolations = 0;
        let lowSpeedStreak = 0;

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
            const dtMin =
              (p.recordedAt.getTime() - prev.recordedAt.getTime()) / 60000;
            if (speed > 5) movingMinutes += dtMin;
            if (speed <= 5) {
              lowSpeedStreak += dtMin;
              if (lowSpeedStreak >= 5 && (positions[i - 1]!.speedKmh ?? 0) > 5) {
                stopCount++;
              }
            } else {
              lowSpeedStreak = 0;
            }
          }
        }

        const alerts = await prisma.alert.findMany({
          where: { vehicleId: vehicle.id, createdAt: { gte: from, lte: to } },
        });
        const dmsAlertCount = alerts.filter((a) => dmsSet.has(a.type)).length;

        const score = computeDriverScore({
          dmsAlertCount,
          speedViolationCount: speedViolations,
          alertCount: alerts.length,
        });

        reports.push({
          vehicleId: vehicle.id,
          plate: vehicle.plate,
          label: vehicle.label,
          distanceKm: Math.round(distance * 10) / 10,
          maxSpeedKmh: Math.round(maxSpeed),
          avgSpeedKmh: speedCount ? Math.round(speedSum / speedCount) : 0,
          stopCount,
          movingMinutes: Math.round(movingMinutes),
          alertCount: alerts.length,
          dmsAlertCount,
          speedViolationCount: speedViolations,
          score,
        });
      }

      const totals = {
        distanceKm: Math.round(reports.reduce((s, r) => s + r.distanceKm, 0) * 10) / 10,
        alertCount: reports.reduce((s, r) => s + r.alertCount, 0),
        dmsAlertCount: reports.reduce((s, r) => s + r.dmsAlertCount, 0),
        avgScore: reports.length
          ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length)
          : 0,
      };

      return { from: from.toISOString(), to: to.toISOString(), speedLimitKmh: speedLimit, vehicles: reports, totals };
    },
  );
}

export { alertSeverity };
