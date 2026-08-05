import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { startLiveStream, requestVideoClip, stopLiveStream } from "../lib/jimi-client.js";
import { toLiveStreamDto } from "../lib/mappers.js";

const LIVE_DURATION_MS = 20 * 60 * 1000;

export async function registerMediaRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.post<{ Params: { vehicleId: string }; Body: { channel?: number } }>(
    "/vehicles/:vehicleId/live-stream",
    auth,
    async (request, reply) => {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.params.vehicleId,
          organizationId: request.authUser!.organizationId,
        },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });
      if (!vehicle.cameraDeviceId) {
        return reply.status(400).send({ error: "Câmera JC371 não configurada" });
      }

      const channel = request.body?.channel ?? 1;
      const expiresAt = new Date(Date.now() + LIVE_DURATION_MS);

      try {
        const { streamUrl } = await startLiveStream(
          request.authUser!.organizationId,
          vehicle.cameraDeviceId,
          channel,
        );

        const session = await prisma.liveStreamSession.create({
          data: {
            vehicleId: vehicle.id,
            streamUrl,
            channel,
            expiresAt,
          },
        });

        return toLiveStreamDto(session);
      } catch (err) {
        const session = await prisma.liveStreamSession.create({
          data: { vehicleId: vehicle.id, channel, expiresAt, streamUrl: null },
        });
        return {
          ...toLiveStreamDto(session),
          error: err instanceof Error ? err.message : "Falha ao iniciar live",
          hint: "Verifique appKey/appSecret Jimi em Integrações",
        };
      }
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    "/live-stream/:sessionId",
    auth,
    async (request, reply) => {
      const session = await prisma.liveStreamSession.findFirst({
        where: { id: request.params.sessionId },
        include: { vehicle: true },
      });
      if (!session || session.vehicle.organizationId !== request.authUser!.organizationId) {
        return reply.status(404).send({ error: "Sessão não encontrada" });
      }

      if (session.vehicle.cameraDeviceId) {
        try {
          await stopLiveStream(
            request.authUser!.organizationId,
            session.vehicle.cameraDeviceId,
            session.channel,
          );
        } catch {
          /* ignore stop errors */
        }
      }

      await prisma.liveStreamSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date() },
      });
      return { ok: true };
    },
  );

  app.post<{ Params: { vehicleId: string } }>(
    "/vehicles/:vehicleId/request-video",
    auth,
    async (request, reply) => {
      const schema = z.object({
        startTime: z.string(),
        durationSec: z.number().optional(),
        channel: z.number().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: request.params.vehicleId,
          organizationId: request.authUser!.organizationId,
        },
      });
      if (!vehicle?.cameraDeviceId) {
        return reply.status(400).send({ error: "Câmera não configurada" });
      }

      try {
        const result = await requestVideoClip(
          request.authUser!.organizationId,
          vehicle.cameraDeviceId,
          parsed.data.startTime,
          parsed.data.durationSec ?? 60,
          parsed.data.channel ?? 1,
        );
        return { ok: true, message: "Solicitação enviada à câmera", result };
      } catch (err) {
        return reply.status(502).send({
          error: err instanceof Error ? err.message : "Falha na API Jimi",
        });
      }
    },
  );
}
