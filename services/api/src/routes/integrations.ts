import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getDefaultOrganization } from "../lib/seed.js";
import { toGt06IntegrationDto, toJimiIntegrationDto } from "../lib/mappers.js";

const jimiSchema = z.object({
  label: z.string().optional(),
  appKey: z.string().nullable().optional(),
  appSecret: z.string().nullable().optional(),
  pushUrl: z.string().nullable().optional(),
  apiBaseUrl: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

const gt06Schema = z.object({
  label: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  enabled: z.boolean().optional(),
});

export async function registerIntegrationRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  async function orgId(request: { authUser?: { organizationId: string } }) {
    return request.authUser!.organizationId;
  }

  app.get("/integrations/jimi", auth, async (request) => {
    const organizationId = await orgId(request);
    let integration = await prisma.jimiIntegration.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    if (!integration) {
      integration = await prisma.jimiIntegration.create({
        data: { organizationId },
      });
    }
    return toJimiIntegrationDto(integration);
  });

  app.put("/integrations/jimi", auth, async (request, reply) => {
    const parsed = jimiSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const organizationId = await orgId(request);
    let integration = await prisma.jimiIntegration.findFirst({
      where: { organizationId },
    });
    if (!integration) {
      integration = await prisma.jimiIntegration.create({ data: { organizationId } });
    }

    const data = parsed.data;
    const updated = await prisma.jimiIntegration.update({
      where: { id: integration.id },
      data: {
        label: data.label,
        appKey: data.appKey,
        pushUrl: data.pushUrl,
        apiBaseUrl: data.apiBaseUrl,
        enabled: data.enabled,
        ...(data.appSecret !== undefined ? { appSecret: data.appSecret } : {}),
      },
    });

    return toJimiIntegrationDto(updated);
  });

  app.get("/integrations/gt06", auth, async (request) => {
    const organizationId = await orgId(request);
    let integration = await prisma.gt06Integration.findFirst({
      where: { organizationId },
    });
    if (!integration) {
      integration = await prisma.gt06Integration.create({ data: { organizationId } });
    }
    return toGt06IntegrationDto(integration);
  });

  app.put("/integrations/gt06", auth, async (request, reply) => {
    const parsed = gt06Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const organizationId = await orgId(request);
    let integration = await prisma.gt06Integration.findFirst({
      where: { organizationId },
    });
    if (!integration) {
      integration = await prisma.gt06Integration.create({ data: { organizationId } });
    }

    const updated = await prisma.gt06Integration.update({
      where: { id: integration.id },
      data: parsed.data,
    });

    return toGt06IntegrationDto(updated);
  });

  app.get("/integrations/status", auth, async (request) => {
    const organizationId = await orgId(request);
    const [jimi, gt06, trackerSessions, vehicles] = await Promise.all([
      prisma.jimiIntegration.findFirst({ where: { organizationId } }),
      prisma.gt06Integration.findFirst({ where: { organizationId } }),
      prisma.trackerSession.count({ where: { connected: true } }),
      prisma.vehicle.count({ where: { organizationId } }),
    ]);

    return {
      jimi: {
        configured: Boolean(jimi?.appKey && jimi?.appSecret),
        enabled: jimi?.enabled ?? false,
        pushUrl: jimi?.pushUrl ?? null,
      },
      gt06: {
        enabled: gt06?.enabled ?? true,
        host: gt06?.host ?? "localhost",
        port: gt06?.port ?? 5023,
        activeSessions: trackerSessions,
      },
      vehicles,
    };
  });
}

// Used by Jimi webhooks to resolve vehicles across orgs
export async function findVehicleByCameraGlobally(deviceId: string) {
  const normalized = deviceId.replace(/\D/g, "");
  return prisma.vehicle.findFirst({
    where: {
      OR: [{ cameraDeviceId: deviceId }, { cameraDeviceId: normalized }],
    },
  });
}

export async function findVehicleByTrackerGlobally(imei: string) {
  const normalized = imei.replace(/\D/g, "");
  return prisma.vehicle.findFirst({
    where: {
      OR: [{ trackerImei: imei }, { trackerImei: normalized }],
    },
  });
}

export { getDefaultOrganization };
