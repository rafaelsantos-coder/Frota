import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toGeofenceDto } from "../lib/mappers.js";

const createSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().int().min(50).max(50000).optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

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

    const fence = await prisma.geofence.create({
      data: {
        organizationId: request.authUser!.organizationId,
        name: parsed.data.name,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        radiusMeters: parsed.data.radiusMeters ?? 500,
        enabled: parsed.data.enabled ?? true,
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

    const fence = await prisma.geofence.update({
      where: { id: existing.id },
      data: parsed.data,
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
