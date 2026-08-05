import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DeviceCommandDto } from "@frota/shared";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { sendGt06Command } from "../lib/gt06-command-client.js";

const commandSchema = z.object({
  type: z.enum(["BLOCK", "UNBLOCK"]),
});

function toCommandDto(cmd: {
  id: string;
  vehicleId: string;
  imei: string;
  type: string;
  status: string;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
}): DeviceCommandDto {
  return {
    id: cmd.id,
    vehicleId: cmd.vehicleId,
    imei: cmd.imei,
    type: cmd.type as DeviceCommandDto["type"],
    status: cmd.status as DeviceCommandDto["status"],
    error: cmd.error,
    createdAt: cmd.createdAt.toISOString(),
    sentAt: cmd.sentAt?.toISOString() ?? null,
  };
}

export async function registerCommandRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.authenticate, requireAdmin] };

  app.get<{ Params: { id: string } }>("/vehicles/:id/commands", admin, async (request) => {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!vehicle) return [];

    const commands = await prisma.deviceCommand.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return commands.map(toCommandDto);
  });

  app.post<{ Params: { id: string } }>("/vehicles/:id/commands", admin, async (request, reply) => {
    const parsed = commandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!vehicle) {
      return reply.status(404).send({ error: "Veículo não encontrado" });
    }
    if (!vehicle.trackerImei) {
      return reply.status(400).send({ error: "Veículo sem rastreador GT06 vinculado" });
    }

    const command = await prisma.deviceCommand.create({
      data: {
        vehicleId: vehicle.id,
        imei: vehicle.trackerImei,
        type: parsed.data.type,
        createdBy: request.authUser!.sub,
      },
    });

    try {
      await sendGt06Command(vehicle.trackerImei, parsed.data.type);
      const updated = await prisma.deviceCommand.update({
        where: { id: command.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      return reply.status(201).send(toCommandDto(updated));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar comando";
      const updated = await prisma.deviceCommand.update({
        where: { id: command.id },
        data: { status: "FAILED", error: message },
      });
      return reply.status(503).send({ error: message, command: toCommandDto(updated) });
    }
  });
}
