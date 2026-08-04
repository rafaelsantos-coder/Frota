import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toVehicleDto } from "../lib/mappers.js";

const createVehicleSchema = z.object({
  plate: z.string().min(1),
  label: z.string().min(1),
  trackerImei: z.string().optional(),
  cameraDeviceId: z.string().optional(),
  cameraModel: z.enum(["JC371"]).optional(),
});

const updateVehicleSchema = createVehicleSchema.partial().extend({
  trackerImei: z.string().nullable().optional(),
  cameraDeviceId: z.string().nullable().optional(),
  cameraModel: z.enum(["JC371"]).nullable().optional(),
});

export async function registerVehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", async () => {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return vehicles.map(toVehicleDto);
  });

  app.get<{ Params: { id: string } }>("/vehicles/:id", async (request, reply) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
    if (!vehicle) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }
    return toVehicleDto(vehicle);
  });

  app.post("/vehicles", async (request, reply) => {
    const parsed = createVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: parsed.data.plate.toUpperCase(),
        label: parsed.data.label,
        trackerImei: parsed.data.trackerImei ?? null,
        cameraDeviceId: parsed.data.cameraDeviceId ?? null,
        cameraModel: parsed.data.cameraModel ?? (parsed.data.cameraDeviceId ? "JC371" : null),
      },
    });

    return reply.status(201).send(toVehicleDto(vehicle));
  });

  app.patch<{ Params: { id: string } }>("/vehicles/:id", async (request, reply) => {
    const parsed = updateVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
    if (!existing) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: request.params.id },
      data: {
        ...parsed.data,
        plate: parsed.data.plate?.toUpperCase(),
      },
    });

    return toVehicleDto(vehicle);
  });

  app.delete<{ Params: { id: string } }>("/vehicles/:id", async (request, reply) => {
    await prisma.vehicle.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
