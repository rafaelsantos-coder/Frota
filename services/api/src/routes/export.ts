import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { orgVehicleIds } from "../lib/drivers.js";
import { analyzeRoute, computeDriverScore } from "../lib/geo.js";
import { toCsv, toSimplePdf } from "../lib/export.js";
import { JIMI_DMS_EVENTS } from "@frota/shared";

const dmsSet = new Set<string>(JIMI_DMS_EVENTS);

export async function registerExportRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get<{ Querystring: { from?: string; to?: string; format?: string } }>(
    "/export/reports/fleet",
    auth,
    async (request, reply) => {
      const orgId = request.authUser!.organizationId;
      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      const format = request.query.format ?? "csv";
      const speedLimit = Number(process.env.SPEED_LIMIT_KMH ?? 80);

      const vehicles = await prisma.vehicle.findMany({ where: { organizationId: orgId } });
      const reports = [];

      for (const vehicle of vehicles) {
        const positions = await prisma.position.findMany({
          where: { vehicleId: vehicle.id, recordedAt: { gte: from, lte: to } },
          orderBy: { recordedAt: "asc" },
        });
        const stats = analyzeRoute(positions, speedLimit);
        const alerts = await prisma.alert.findMany({
          where: { vehicleId: vehicle.id, createdAt: { gte: from, lte: to } },
        });
        const dmsAlertCount = alerts.filter((a) => dmsSet.has(a.type)).length;
        const score = computeDriverScore({
          dmsAlertCount,
          speedViolationCount: stats.speedViolationCount,
          alertCount: alerts.length,
          idleMinutes: stats.idleMinutes,
        });
        reports.push({
          plate: vehicle.plate,
          label: vehicle.label,
          ...stats,
          dmsAlertCount,
          speedViolationCount: stats.speedViolationCount,
          score,
        });
      }

      const headers = ["Placa", "Veículo", "Km", "Vel. Máx", "Paradas", "DMS", "Excessos", "Score"];
      const rows = reports.map((v) => [
        v.plate,
        v.label,
        v.distanceKm,
        v.maxSpeedKmh,
        v.stopCount,
        v.dmsAlertCount,
        v.speedViolationCount,
        v.score,
      ]);

      if (format === "pdf") {
        const pdf = toSimplePdf(
          "Relatório de Frota Sulnet",
          reports.map((v) => `${v.plate} | ${v.label} | ${v.distanceKm}km | score ${v.score}`),
        );
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", 'attachment; filename="relatorio-frota.pdf"');
        return reply.send(Buffer.from(pdf, "utf8"));
      }

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="relatorio-frota.csv"');
      return toCsv(headers, rows);
    },
  );

  app.get<{ Querystring: { format?: string } }>("/export/alerts", auth, async (request, reply) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const format = request.query.format ?? "csv";
    const alerts = await prisma.alert.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { vehicle: { select: { plate: true } } },
    });

    const headers = ["Data", "Veículo", "Tipo", "Descrição", "Severidade", "Status"];
    const rows = alerts.map((a) => [
      a.createdAt.toISOString(),
      a.vehicle?.plate ?? "—",
      a.type,
      a.label,
      a.severity,
      a.status,
    ]);

    if (format === "pdf") {
      const pdf = toSimplePdf(
        "Alertas Sulnet",
        alerts.slice(0, 40).map((a) => `${a.createdAt.toISOString().slice(0, 16)} ${a.label}`),
      );
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'attachment; filename="alertas.pdf"');
      return reply.send(Buffer.from(pdf, "utf8"));
    }

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="alertas.csv"');
    return toCsv(headers, rows);
  });
}
