import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { assignDriverToVehicle, getCurrentVehicleForDriver } from "../lib/drivers.js";
import { toDriverDto } from "../lib/mappers.js";
import { extractCnhFromImage, parseDateOnly } from "../lib/cnh-extract.js";

const createSchema = z.object({
  name: z.string().min(1),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  cnh: z.string().optional(),
  birthDate: z.string().optional(),
  cnhExpiry: z.string().optional(),
  photoData: z.string().optional(),
  rfidTag: z.string().optional(),
  ibuttonId: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({ active: z.boolean().optional() });

const extractSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().default("image/jpeg"),
});

function driverDataFromInput(data: z.infer<typeof createSchema>) {
  return {
    name: data.name,
    cpf: data.cpf ?? null,
    rg: data.rg ?? null,
    cnh: data.cnh ?? null,
    birthDate: parseDateOnly(data.birthDate),
    cnhExpiry: parseDateOnly(data.cnhExpiry),
    photoData: data.photoData ?? null,
    rfidTag: data.rfidTag ?? null,
    ibuttonId: data.ibuttonId ?? null,
  };
}

export async function registerDriverRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  app.post("/drivers/extract-cnh", auth, async (request, reply) => {
    const parsed = extractSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Envie a imagem da CNH digital (JPEG/PNG)" });
    }

    try {
      const result = await extractCnhFromImage(parsed.data.imageBase64, parsed.data.mimeType);
      return result;
    } catch (error) {
      return reply.status(502).send({
        error: error instanceof Error ? error.message : "Erro ao extrair dados da CNH",
      });
    }
  });

  app.get("/drivers", auth, async (request) => {
    const orgId = request.authUser!.organizationId;
    const drivers = await prisma.driver.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
    return Promise.all(
      drivers.map(async (d) => toDriverDto(d, await getCurrentVehicleForDriver(d.id))),
    );
  });

  app.get("/drivers/ranking", auth, async (request) => {
    const orgId = request.authUser!.organizationId;
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const drivers = await prisma.driver.findMany({ where: { organizationId: orgId, active: true } });

    const ranking = [];
    for (const driver of drivers) {
      const alerts = await prisma.alert.findMany({
        where: { driverId: driver.id, createdAt: { gte: from } },
      });
      const positions = await prisma.position.findMany({
        where: { driverId: driver.id, recordedAt: { gte: from } },
        orderBy: { recordedAt: "asc" },
      });

      let distance = 0;
      let maxSpeed = 0;
      let speedSum = 0;
      let speedCount = 0;
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1]!;
        const curr = positions[i]!;
        distance +=
          Math.abs(curr.latitude - prev.latitude) + Math.abs(curr.longitude - prev.longitude);
        const speed = curr.speedKmh ?? 0;
        if (speed > maxSpeed) maxSpeed = speed;
        if (speed > 0) {
          speedSum += speed;
          speedCount++;
        }
      }

      const dmsCount = alerts.filter((a) =>
        ["SMOKING", "PHONECALLING", "DISTRACTION", "FATIGUE", "EYESCLOSED"].includes(a.type),
      ).length;
      const speedViolations = alerts.filter((a) => a.type === "OVERSPEED").length;

      ranking.push({
        driverId: driver.id,
        name: driver.name,
        distanceKm: Math.round(distance * 111 * 10) / 10,
        maxSpeedKmh: Math.round(maxSpeed),
        avgSpeedKmh: speedCount ? Math.round(speedSum / speedCount) : 0,
        alertCount: alerts.length,
        dmsAlertCount: dmsCount,
        speedViolationCount: speedViolations,
        idleMinutes: 0,
        score: Math.max(
          0,
          100 - dmsCount * 8 - speedViolations * 3 - Math.max(0, alerts.length - dmsCount) * 2,
        ),
      });
    }

    return ranking.sort((a, b) => b.score - a.score);
  });

  app.get<{ Params: { id: string } }>("/drivers/:id", auth, async (request, reply) => {
    const driver = await prisma.driver.findFirst({
      where: { id: request.params.id, organizationId: request.authUser!.organizationId },
    });
    if (!driver) return reply.status(404).send({ error: "Motorista não encontrado" });
    return toDriverDto(driver, await getCurrentVehicleForDriver(driver.id));
  });

  app.post("/drivers", auth, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const driver = await prisma.driver.create({
      data: {
        organizationId: request.authUser!.organizationId,
        ...driverDataFromInput(parsed.data),
      },
    });
    return reply.status(201).send(toDriverDto(driver, null));
  });

  app.patch<{ Params: { id: string } }>("/drivers/:id", auth, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.driver.findFirst({
      where: { id: request.params.id, organizationId: request.authUser!.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Motorista não encontrado" });

    const { birthDate, cnhExpiry, ...rest } = parsed.data;
    const driver = await prisma.driver.update({
      where: { id: existing.id },
      data: {
        ...rest,
        birthDate: birthDate !== undefined ? parseDateOnly(birthDate) : undefined,
        cnhExpiry: cnhExpiry !== undefined ? parseDateOnly(cnhExpiry) : undefined,
      },
    });
    return toDriverDto(driver, await getCurrentVehicleForDriver(driver.id));
  });

  app.delete<{ Params: { id: string } }>("/drivers/:id", auth, async (request, reply) => {
    const existing = await prisma.driver.findFirst({
      where: { id: request.params.id, organizationId: request.authUser!.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Motorista não encontrado" });
    await prisma.driver.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string }; Body: { vehicleId: string } }>(
    "/drivers/:id/assign",
    auth,
    async (request, reply) => {
      const driver = await prisma.driver.findFirst({
        where: { id: request.params.id, organizationId: request.authUser!.organizationId },
      });
      if (!driver) return reply.status(404).send({ error: "Motorista não encontrado" });

      const vehicle = await prisma.vehicle.findFirst({
        where: { id: request.body.vehicleId, organizationId: request.authUser!.organizationId },
      });
      if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

      await assignDriverToVehicle(driver.id, vehicle.id);
      return toDriverDto(driver, vehicle);
    },
  );
}
