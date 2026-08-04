import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
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
  app.get("/integrations/jimi", async () => {
    let integration = await prisma.jimiIntegration.findFirst({ orderBy: { createdAt: "asc" } });
    if (!integration) {
      integration = await prisma.jimiIntegration.create({ data: {} });
    }
    return toJimiIntegrationDto(integration);
  });

  app.put("/integrations/jimi", async (request, reply) => {
    const parsed = jimiSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    let integration = await prisma.jimiIntegration.findFirst({ orderBy: { createdAt: "asc" } });
    if (!integration) {
      integration = await prisma.jimiIntegration.create({ data: {} });
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

  app.get("/integrations/gt06", async () => {
    let integration = await prisma.gt06Integration.findFirst({ orderBy: { createdAt: "asc" } });
    if (!integration) {
      integration = await prisma.gt06Integration.create({ data: {} });
    }
    return toGt06IntegrationDto(integration);
  });

  app.put("/integrations/gt06", async (request, reply) => {
    const parsed = gt06Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    let integration = await prisma.gt06Integration.findFirst({ orderBy: { createdAt: "asc" } });
    if (!integration) {
      integration = await prisma.gt06Integration.create({ data: {} });
    }

    const updated = await prisma.gt06Integration.update({
      where: { id: integration.id },
      data: parsed.data,
    });

    return toGt06IntegrationDto(updated);
  });

  app.get("/integrations/status", async () => {
    const [jimi, gt06, trackerSessions, vehicles] = await Promise.all([
      prisma.jimiIntegration.findFirst(),
      prisma.gt06Integration.findFirst(),
      prisma.trackerSession.count({ where: { connected: true } }),
      prisma.vehicle.count(),
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
