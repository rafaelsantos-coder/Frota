import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { PublicTrackDto, ShareLinkDto } from "@frota/shared";

const createSchema = z.object({
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

function publicWebUrl(token: string) {
  const base = process.env.WEB_PUBLIC_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/track/${token}`;
}

export async function registerShareRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.get<{ Params: { vehicleId: string } }>(
    "/vehicles/:vehicleId/share-links",
    auth,
    async (request) => {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.params.vehicleId,
          organizationId: request.authUser!.organizationId,
        },
      });
      if (!vehicle) return [];

      const links = await prisma.shareLink.findMany({
        where: { vehicleId: vehicle.id, revoked: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return links.map(
        (link): ShareLinkDto => ({
          id: link.id,
          vehicleId: link.vehicleId,
          token: link.token,
          url: publicWebUrl(link.token),
          expiresAt: link.expiresAt.toISOString(),
          revoked: link.revoked,
          createdAt: link.createdAt.toISOString(),
        }),
      );
    },
  );

  app.post<{ Params: { vehicleId: string } }>(
    "/vehicles/:vehicleId/share-links",
    auth,
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.params.vehicleId,
          organizationId: request.authUser!.organizationId,
        },
      });
      if (!vehicle) {
        return reply.status(404).send({ error: "Veículo não encontrado" });
      }

      const hours = parsed.data.expiresInHours ?? 24;
      const token = crypto.randomBytes(24).toString("base64url");
      const link = await prisma.shareLink.create({
        data: {
          vehicleId: vehicle.id,
          token,
          expiresAt: new Date(Date.now() + hours * 3600_000),
        },
      });

      const dto: ShareLinkDto = {
        id: link.id,
        vehicleId: link.vehicleId,
        token: link.token,
        url: publicWebUrl(link.token),
        expiresAt: link.expiresAt.toISOString(),
        revoked: link.revoked,
        createdAt: link.createdAt.toISOString(),
      };

      return reply.status(201).send(dto);
    },
  );

  app.delete<{ Params: { id: string } }>("/share-links/:id", auth, async (request, reply) => {
    const link = await prisma.shareLink.findFirst({
      where: { id: request.params.id },
      include: { vehicle: true },
    });
    if (!link || link.vehicle.organizationId !== request.authUser!.organizationId) {
      return reply.status(404).send({ error: "Link não encontrado" });
    }

    await prisma.shareLink.update({
      where: { id: link.id },
      data: { revoked: true },
    });

    return reply.status(204).send();
  });

  app.get<{ Params: { token: string } }>("/public/track/:token", async (request, reply) => {
    const link = await prisma.shareLink.findUnique({
      where: { token: request.params.token },
      include: {
        vehicle: {
          include: {
            positions: { orderBy: { recordedAt: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!link || link.revoked || link.expiresAt < new Date()) {
      return reply.status(404).send({ error: "Link inválido ou expirado" });
    }

    const session = link.vehicle.trackerImei
      ? await prisma.trackerSession.findUnique({ where: { imei: link.vehicle.trackerImei } })
      : null;

    const position = link.vehicle.positions[0];
    const dto: PublicTrackDto = {
      label: link.vehicle.label,
      plate: link.vehicle.plate,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      speedKmh: position?.speedKmh ?? null,
      recordedAt: position?.recordedAt.toISOString() ?? null,
      commStatus: session?.connected ? "ONLINE" : link.vehicle.trackerStatus,
      expiresAt: link.expiresAt.toISOString(),
    };

    return dto;
  });
}
