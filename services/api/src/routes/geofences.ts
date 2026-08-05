import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { polygonCentroid } from "../lib/geo.js";
import { toGeofenceDto } from "../lib/mappers.js";

const pointSchema = z.tuple([z.number(), z.number()]);

const createSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["CIRCLE", "POLYGON"]).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radiusMeters: z.number().int().min(50).max(50000).optional(),
    polygon: z.array(pointSchema).min(3).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "POLYGON" || data.polygon) {
      if (!data.polygon || data.polygon.length < 3) {
        ctx.addIssue({ code: "custom", message: "Polígono requer ao menos 3 pontos" });
      }
    } else if (data.latitude == null || data.longitude == null) {
      ctx.addIssue({ code: "custom", message: "Círculo requer latitude e longitude" });
    }
  });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["CIRCLE", "POLYGON"]).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusMeters: z.number().int().min(50).max(50000).optional(),
  polygon: z.array(pointSchema).min(3).nullable().optional(),
  enabled: z.boolean().optional(),
});

function resolveGeofenceData(parsed: {
  type?: "CIRCLE" | "POLYGON";
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  polygon?: Array<[number, number]> | null;
}) {
  const type = parsed.type ?? (parsed.polygon ? "POLYGON" : "CIRCLE");
  if (type === "POLYGON" && parsed.polygon) {
    const centroid = polygonCentroid(parsed.polygon);
    return {
      type: "POLYGON" as const,
      latitude: centroid.lat,
      longitude: centroid.lon,
      radiusMeters: 0,
      polygon: parsed.polygon,
    };
  }
  return {
    type: "CIRCLE" as const,
    latitude: parsed.latitude!,
    longitude: parsed.longitude!,
    radiusMeters: parsed.radiusMeters ?? 500,
    polygon: undefined,
  };
}

export async function registerGeofenceRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/geofences", auth, async (request) => {
    const fences = await prisma.geofence.findMany({
      where: { organizationId: request.authUser!.organizationId },
      orderBy: { name: "asc" },
    });
    return fences.map(toGeofenceDto);
  });

  app.post("/geofences", auth, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const geo = resolveGeofenceData(parsed.data);
    const fence = await prisma.geofence.create({
      data: {
        organizationId: request.authUser!.organizationId,
        name: parsed.data.name,
        enabled: parsed.data.enabled ?? true,
        ...geo,
      },
    });

    return reply.status(201).send(toGeofenceDto(fence));
  });

  app.patch<{ Params: { id: string } }>("/geofences/:id", auth, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.geofence.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Cerca não encontrada" });
    }

    const merged = {
      name: parsed.data.name ?? existing.name,
      type: (parsed.data.type ?? existing.type) as "CIRCLE" | "POLYGON",
      latitude: parsed.data.latitude ?? existing.latitude,
      longitude: parsed.data.longitude ?? existing.longitude,
      radiusMeters: parsed.data.radiusMeters ?? existing.radiusMeters,
      polygon:
        parsed.data.polygon !== undefined
          ? parsed.data.polygon
          : (existing.polygon as Array<[number, number]> | null),
      enabled: parsed.data.enabled ?? existing.enabled,
    };

    const geo = resolveGeofenceData(merged);
    const fence = await prisma.geofence.update({
      where: { id: existing.id },
      data: {
        name: merged.name,
        enabled: merged.enabled,
        ...geo,
      },
    });

    return toGeofenceDto(fence);
  });

  app.delete<{ Params: { id: string } }>("/geofences/:id", auth, async (request, reply) => {
    const existing = await prisma.geofence.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Cerca não encontrada" });
    }

    await prisma.geofence.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });
}
