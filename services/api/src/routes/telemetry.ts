import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  toAlertDto,
  toPositionDto,
  toStopPointDto,
  toVehicleDto,
  toVideoClipDto,
} from "../lib/mappers.js";
import {
  alertSeverity,
  analyzeRoute,
  computeDriverScore,
  detectStopPoints,
  detectTelemetryEvents,
  distanceKm,
} from "../lib/geo.js";
import { JIMI_DMS_EVENTS } from "@frota/shared";
import { orgVehicleIds } from "../lib/drivers.js";

const dmsSet = new Set<string>(JIMI_DMS_EVENTS);

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
      if (!vehicleId) return reply.status(400).send({ error: "vehicleId é obrigatório" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: orgId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      const limit = Math.min(Number(request.query.limit ?? 2000), 5000);

      const positions = await prisma.position.findMany({
        where: { vehicleId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: "asc" },
        take: limit,
      });

      return positions.map(toPositionDto);
    },
  );

  app.get<{ Querystring: { vehicleId?: string; from?: string; to?: string; limit?: string } }>(
    "/positions/trail",
    auth,
    async (request, reply) => {
      const vehicleId = request.query.vehicleId;
      if (!vehicleId) return reply.status(400).send({ error: "vehicleId é obrigatório" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: request.authUser!.organizationId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const limit = Math.min(Number(request.query.limit ?? 100), 500);
      const positions = await prisma.position.findMany({
        where: { vehicleId },
        orderBy: { recordedAt: "desc" },
        take: limit,
      });

      return positions.reverse().map(toPositionDto);
    },
  );

  app.get<{ Querystring: { vehicleId?: string; from?: string; to?: string } }>(
    "/positions/timeline",
    auth,
    async (request, reply) => {
      const vehicleId = request.query.vehicleId;
      if (!vehicleId) return reply.status(400).send({ error: "vehicleId é obrigatório" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: request.authUser!.organizationId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 3 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();

      const positions = await prisma.position.findMany({
        where: { vehicleId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: "asc" },
      });

      const { buildTimeline } = await import("../lib/timeline.js");
      return buildTimeline(positions);
    },
  );

  app.get<{ Querystring: { lat?: string; lng?: string } }>(
    "/geocode/reverse",
    auth,
    async (request, reply) => {
      const lat = Number(request.query.lat);
      const lng = Number(request.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return reply.status(400).send({ error: "lat e lng são obrigatórios" });
      }

      const { reverseGeocode } = await import("../lib/geocode.js");
      const address = await reverseGeocode(lat, lng);
      return { address };
    },
  );

  app.get<{ Params: { vehicleId: string } }>(
    "/vehicles/:vehicleId/live-status",
    auth,
    async (request, reply) => {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.params.vehicleId,
          organizationId: request.authUser!.organizationId,
        },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const position = await prisma.position.findFirst({
        where: { vehicleId: vehicle.id },
        orderBy: { recordedAt: "desc" },
      });

      let session = null;
      if (vehicle.trackerImei) {
        session = await prisma.trackerSession.findUnique({
          where: { imei: vehicle.trackerImei.replace(/\D/g, "") },
        });
      }

      const { vehicleLiveStatus } = await import("../lib/timeline.js");
      const status = vehicleLiveStatus({
        trackerStatus: vehicle.trackerStatus,
        lastPositionAt: position?.recordedAt ?? null,
        speedKmh: position?.speedKmh ?? null,
        ignitionOn: position?.ignitionOn ?? null,
        sessionConnected: session?.connected ?? null,
        sessionLastSeen: session?.lastSeenAt ?? null,
      });

      let address: string | null = null;
      if (position) {
        const { reverseGeocode } = await import("../lib/geocode.js");
        address = await reverseGeocode(position.latitude, position.longitude);
      }

      return { ...status, address };
    },
  );

  app.get<{ Querystring: { vehicleId?: string; from?: string; to?: string } }>(
    "/positions/stops",
    auth,
    async (request, reply) => {
      const vehicleId = request.query.vehicleId;
      if (!vehicleId) return reply.status(400).send({ error: "vehicleId é obrigatório" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: request.authUser!.organizationId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();

      const positions = await prisma.position.findMany({
        where: { vehicleId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: "asc" },
      });

      const stops = detectStopPoints(positions);
      return stops.map((s, i) =>
        toStopPointDto({
          id: `stop-${i}`,
          vehicleId,
          latitude: s.latitude,
          longitude: s.longitude,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationMin: s.durationMin,
        }),
      );
    },
  );

  app.get<{ Querystring: { vehicleId?: string; from?: string; to?: string } }>(
    "/positions/events",
    auth,
    async (request, reply) => {
      const vehicleId = request.query.vehicleId;
      if (!vehicleId) return reply.status(400).send({ error: "vehicleId é obrigatório" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId: request.authUser!.organizationId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();

      const [positions, alerts] = await Promise.all([
        prisma.position.findMany({
          where: { vehicleId, recordedAt: { gte: from, lte: to } },
          orderBy: { recordedAt: "asc" },
        }),
        prisma.alert.findMany({
          where: { vehicleId, createdAt: { gte: from, lte: to } },
        }),
      ]);

      const telemetryEvents = detectTelemetryEvents(positions).map((e, i) => ({
        id: `tel-${i}`,
        type: e.type,
        label: e.label,
        latitude: e.latitude,
        longitude: e.longitude,
        recordedAt: e.recordedAt.toISOString(),
        severity: alertSeverity(e.type),
      }));

      const alertEvents = alerts.map((a) => ({
        id: a.id,
        type: a.type,
        label: a.label,
        latitude: (a.payload as { lat?: number }).lat ?? positions[0]?.latitude ?? 0,
        longitude: (a.payload as { lng?: number }).lng ?? positions[0]?.longitude ?? 0,
        recordedAt: a.createdAt.toISOString(),
        severity: a.severity,
      }));

      return [...telemetryEvents, ...alertEvents];
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
        driver: { select: { id: true, name: true } },
        videoClips: true,
      },
    });

    return alerts.map(toAlertDto);
  });

  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    "/alerts/:id/status",
    auth,
    async (request, reply) => {
      const schema = z.object({ status: z.enum(["NEW", "REVIEWING", "RESOLVED"]) });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
      const alert = await prisma.alert.findFirst({
        where: {
          id: request.params.id,
          OR: [{ vehicleId: { in: vehicleIds } }, { vehicleId: null }],
        },
      });
      if (!alert) return reply.status(404).send({ error: "Alerta não encontrado" });

      const updated = await prisma.alert.update({
        where: { id: alert.id },
        data: { status: parsed.data.status },
        include: {
          vehicle: { select: { id: true, plate: true, label: true } },
          driver: { select: { id: true, name: true } },
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

        const stats = analyzeRoute(positions, speedLimit);

        const [alerts, fuelEntries, maintenanceOrders, fines] = await Promise.all([
          prisma.alert.findMany({
            where: { vehicleId: vehicle.id, createdAt: { gte: from, lte: to } },
          }),
          prisma.fuelEntry.findMany({
            where: { vehicleId: vehicle.id, recordedAt: { gte: from, lte: to } },
          }),
          prisma.maintenanceOrder.findMany({
            where: { vehicleId: vehicle.id, performedAt: { gte: from, lte: to } },
          }),
          prisma.vehicleFine.findMany({
            where: { vehicleId: vehicle.id, createdAt: { gte: from, lte: to } },
          }),
        ]);

        const dmsAlertCount = alerts.filter((a) => dmsSet.has(a.type)).length;
        const fuelCost = fuelEntries.reduce((s, e) => s + e.amountPaid, 0);
        const maintenanceCost = maintenanceOrders.reduce(
          (s, m) => s + m.partsCost + m.laborCost,
          0,
        );
        const fineCost = fines.reduce((s, f) => s + f.amount, 0);
        const totalCost = fuelCost + maintenanceCost + fineCost;

        const score = computeDriverScore({
          dmsAlertCount,
          speedViolationCount: stats.speedViolationCount,
          alertCount: alerts.length,
          idleMinutes: stats.idleMinutes,
        });

        reports.push({
          vehicleId: vehicle.id,
          plate: vehicle.plate,
          label: vehicle.label,
          ...stats,
          alertCount: alerts.length,
          dmsAlertCount,
          score,
          fuelCost: Math.round(fuelCost * 100) / 100,
          maintenanceCost: Math.round(maintenanceCost * 100) / 100,
          fineCost: Math.round(fineCost * 100) / 100,
          costPerKm:
            stats.distanceKm > 0
              ? Math.round((totalCost / stats.distanceKm) * 100) / 100
              : 0,
        });
      }

      const drivers = await prisma.driver.findMany({
        where: { organizationId: orgId, active: true },
      });
      const driverReports = [];
      for (const driver of drivers) {
        const alerts = await prisma.alert.findMany({
          where: { driverId: driver.id, createdAt: { gte: from, lte: to } },
        });
        const positions = await prisma.position.findMany({
          where: { driverId: driver.id, recordedAt: { gte: from, lte: to } },
          orderBy: { recordedAt: "asc" },
        });
        const stats = analyzeRoute(positions, speedLimit);
        const dmsAlertCount = alerts.filter((a) => dmsSet.has(a.type)).length;
        driverReports.push({
          driverId: driver.id,
          name: driver.name,
          ...stats,
          alertCount: alerts.length,
          dmsAlertCount,
          speedViolationCount: stats.speedViolationCount,
          score: computeDriverScore({
            dmsAlertCount,
            speedViolationCount: stats.speedViolationCount,
            alertCount: alerts.length,
            idleMinutes: stats.idleMinutes,
          }),
        });
      }

      const totalDistance = reports.reduce((s, r) => s + r.distanceKm, 0);
      const totalCost =
        reports.reduce((s, r) => s + r.fuelCost + r.maintenanceCost + r.fineCost, 0);

      return {
        from: from.toISOString(),
        to: to.toISOString(),
        speedLimitKmh: speedLimit,
        vehicles: reports,
        drivers: driverReports.sort((a, b) => b.score - a.score),
        totals: {
          distanceKm: Math.round(totalDistance * 10) / 10,
          alertCount: reports.reduce((s, r) => s + r.alertCount, 0),
          dmsAlertCount: reports.reduce((s, r) => s + r.dmsAlertCount, 0),
          avgScore: reports.length
            ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length)
            : 0,
          fuelCost: Math.round(reports.reduce((s, r) => s + r.fuelCost, 0) * 100) / 100,
          maintenanceCost:
            Math.round(reports.reduce((s, r) => s + r.maintenanceCost, 0) * 100) / 100,
          fineCost: Math.round(reports.reduce((s, r) => s + r.fineCost, 0) * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          costPerKm:
            totalDistance > 0 ? Math.round((totalCost / totalDistance) * 100) / 100 : 0,
        },
      };
    },
  );
}

export { alertSeverity, distanceKm };
