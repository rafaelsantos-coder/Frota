import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { analyzeRoute, computeDriverScore, isReminderDueSoon } from "../lib/geo.js";
import { orgVehicleIds } from "../lib/drivers.js";
import { DEFAULT_DASHBOARD_WIDGETS, JIMI_DMS_EVENTS } from "@frota/shared";

const dmsSet = new Set<string>(JIMI_DMS_EVENTS);

export async function registerDashboardRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/dashboard/kpis", auth, async (request) => {
    const orgId = request.authUser!.organizationId;
    const vehicleIds = await orgVehicleIds(orgId);
    const from7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fromMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [vehicles, drivers, criticalAlerts, sessions, positions, fuelEntries, reminders, fines] =
      await Promise.all([
        prisma.vehicle.count({ where: { organizationId: orgId } }),
        prisma.driver.count({ where: { organizationId: orgId, active: true } }),
        prisma.alert.count({
          where: {
            vehicleId: { in: vehicleIds },
            severity: "CRITICAL",
            status: "NEW",
          },
        }),
        prisma.trackerSession.count({ where: { connected: true } }),
        prisma.position.findMany({
          where: { vehicleId: { in: vehicleIds }, recordedAt: { gte: from7d } },
          orderBy: { recordedAt: "asc" },
        }),
        prisma.fuelEntry.findMany({
          where: { vehicleId: { in: vehicleIds }, recordedAt: { gte: fromMonth } },
        }),
        prisma.maintenanceReminder.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.vehicleFine.findMany({
          where: { vehicleId: { in: vehicleIds }, status: "PENDING" },
        }),
      ]);

    const byVehicle = new Map<string, typeof positions>();
    for (const p of positions) {
      const list = byVehicle.get(p.vehicleId) ?? [];
      list.push(p);
      byVehicle.set(p.vehicleId, list);
    }

    let distanceKm7d = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    for (const [, pts] of byVehicle) {
      const stats = analyzeRoute(pts, Number(process.env.SPEED_LIMIT_KMH ?? 80));
      distanceKm7d += stats.distanceKm;
      const alerts = await prisma.alert.count({
        where: { vehicleId: pts[0]?.vehicleId, createdAt: { gte: from7d } },
      });
      scoreSum += computeDriverScore({
        dmsAlertCount: 0,
        speedViolationCount: stats.speedViolationCount,
        alertCount: alerts,
        idleMinutes: stats.idleMinutes,
      });
      scoreCount++;
    }

    const maintenanceDue = reminders.filter((r) => isReminderDueSoon(r)).length;

    return {
      vehicles,
      drivers,
      onlineTrackers: sessions,
      criticalAlerts,
      distanceKm7d: Math.round(distanceKm7d * 10) / 10,
      avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : 100,
      fuelCostMonth: Math.round(fuelEntries.reduce((s, e) => s + e.amountPaid, 0) * 100) / 100,
      maintenanceDue,
      pendingFines: fines.length,
    };
  });

  app.get("/dashboard/layout", auth, async (request) => {
    const layout = await prisma.dashboardLayout.findUnique({
      where: { userId: request.authUser!.sub },
    });
    return layout?.widgets ?? DEFAULT_DASHBOARD_WIDGETS;
  });

  app.put("/dashboard/layout", auth, async (request) => {
    const widgets = request.body;
    const layout = await prisma.dashboardLayout.upsert({
      where: { userId: request.authUser!.sub },
      create: { userId: request.authUser!.sub, widgets: widgets as object },
      update: { widgets: widgets as object },
    });
    return layout.widgets;
  });

  app.get("/notifications/preferences", auth, async (request) => {
    const prefs = await prisma.notificationPreference.findMany({
      where: { organizationId: request.authUser!.organizationId },
    });
    return prefs;
  });

  app.put("/notifications/preferences", auth, async (request) => {
    const body = request.body as {
      email?: string | null;
      telegramChatId?: string | null;
      onCritical?: boolean;
      onHigh?: boolean;
      onTelegram?: boolean;
    };
    const orgId = request.authUser!.organizationId;
    const existing = await prisma.notificationPreference.findFirst({ where: { organizationId: orgId } });
    if (existing) {
      return prisma.notificationPreference.update({
        where: { id: existing.id },
        data: body,
      });
    }
    return prisma.notificationPreference.create({
      data: { organizationId: orgId, ...body },
    });
  });

  void dmsSet;
}
