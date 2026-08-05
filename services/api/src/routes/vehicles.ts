import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toVehicleDto } from "../lib/mappers.js";

const createVehicleSchema = z.object({
  plate: z.string().min(1),
  label: z.string().min(1),
  renavam: z.string().optional(),
  plateState: z.string().optional(),
  ownerDocument: z.string().optional(),
  trackerImei: z.string().optional(),
  cameraDeviceId: z.string().optional(),
  cameraModel: z.enum(["JC371"]).optional(),
});

const updateVehicleSchema = createVehicleSchema.partial().extend({
  trackerImei: z.string().nullable().optional(),
  cameraDeviceId: z.string().nullable().optional(),
  cameraModel: z.enum(["JC371"]).nullable().optional(),
  renavam: z.string().nullable().optional(),
  plateState: z.string().nullable().optional(),
  ownerDocument: z.string().nullable().optional(),
});

export async function registerVehicleRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get("/vehicles", auth, async (request) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: request.authUser!.organizationId },
      orderBy: { updatedAt: "desc" },
    });
    return vehicles.map(toVehicleDto);
  });

  app.get<{ Params: { id: string } }>("/vehicles/:id", auth, async (request, reply) => {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!vehicle) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }
    return toVehicleDto(vehicle);
  });

  app.post("/vehicles", auth, async (request, reply) => {
    const parsed = createVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: request.authUser!.organizationId,
        plate: parsed.data.plate.toUpperCase(),
        label: parsed.data.label,
        renavam: parsed.data.renavam ?? null,
        plateState: parsed.data.plateState?.toUpperCase() ?? null,
        ownerDocument: parsed.data.ownerDocument ?? null,
        trackerImei: parsed.data.trackerImei ?? null,
        cameraDeviceId: parsed.data.cameraDeviceId ?? null,
        cameraModel: parsed.data.cameraModel ?? (parsed.data.cameraDeviceId ? "JC371" : null),
      },
    });

    return reply.status(201).send(toVehicleDto(vehicle));
  });

  app.patch<{ Params: { id: string } }>("/vehicles/:id", auth, async (request, reply) => {
    const parsed = updateVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.vehicle.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: request.params.id },
      data: {
        ...parsed.data,
        plate: parsed.data.plate?.toUpperCase(),
        plateState: parsed.data.plateState?.toUpperCase(),
      },
    });

    return toVehicleDto(vehicle);
  });

  app.delete<{ Params: { id: string } }>("/vehicles/:id", auth, async (request, reply) => {
    const existing = await prisma.vehicle.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }
    await prisma.vehicle.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
