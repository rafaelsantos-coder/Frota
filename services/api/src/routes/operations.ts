import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { orgVehicleIds, vehicleSelect, driverSelect } from "../lib/drivers.js";
import { isReminderDueSoon } from "../lib/geo.js";
import {
  toChecklistEntryDto,
  toChecklistTemplateDto,
  toFuelEntryDto,
  toMaintenanceOrderDto,
  toMaintenanceReminderDto,
  toVehicleExpenseDto,
  toVehicleFineDto,
} from "../lib/mappers.js";
import { DEFAULT_CHECKLIST_ITEMS } from "@frota/shared";

export async function registerOperationsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // --- Fuel ---
  app.get("/fuel-entries", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const entries = await prisma.fuelEntry.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { recordedAt: "desc" },
      take: 200,
      include: { vehicle: { select: vehicleSelect }, driver: { select: driverSelect } },
    });
    return entries.map(toFuelEntryDto);
  });

  app.post("/fuel-entries", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      driverId: z.string().optional(),
      liters: z.number().positive(),
      amountPaid: z.number().nonnegative(),
      odometerKm: z.number().optional(),
      station: z.string().optional(),
      recordedAt: z.string().datetime(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const entry = await prisma.fuelEntry.create({
      data: {
        ...parsed.data,
        recordedAt: new Date(parsed.data.recordedAt),
      },
      include: { vehicle: { select: vehicleSelect }, driver: { select: driverSelect } },
    });
    return reply.status(201).send(toFuelEntryDto(entry));
  });

  app.get("/fuel-entries/stats", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const entries = await prisma.fuelEntry.findMany({
      where: { vehicleId: { in: vehicleIds }, recordedAt: { gte: from } },
      include: { vehicle: { select: vehicleSelect } },
    });

    const byVehicle = new Map<string, { liters: number; cost: number; plate: string }>();
    for (const e of entries) {
      const key = e.vehicleId;
      const cur = byVehicle.get(key) ?? { liters: 0, cost: 0, plate: e.vehicle.plate };
      cur.liters += e.liters;
      cur.cost += e.amountPaid;
      byVehicle.set(key, cur);
    }

    return {
      totalLiters: entries.reduce((s, e) => s + e.liters, 0),
      totalCost: entries.reduce((s, e) => s + e.amountPaid, 0),
      byVehicle: [...byVehicle.entries()].map(([vehicleId, v]) => ({
        vehicleId,
        plate: v.plate,
        liters: Math.round(v.liters * 10) / 10,
        cost: Math.round(v.cost * 100) / 100,
      })),
    };
  });

  // --- Maintenance ---
  app.get("/maintenance/orders", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const orders = await prisma.maintenanceOrder.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { performedAt: "desc" },
      include: { vehicle: { select: vehicleSelect } },
    });
    return orders.map(toMaintenanceOrderDto);
  });

  app.post("/maintenance/orders", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      type: z.enum(["PREVENTIVE", "CORRECTIVE"]),
      description: z.string().min(1),
      partsCost: z.number().optional(),
      laborCost: z.number().optional(),
      odometerKm: z.number().optional(),
      performedAt: z.string().datetime(),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const order = await prisma.maintenanceOrder.create({
      data: {
        ...parsed.data,
        performedAt: new Date(parsed.data.performedAt),
        partsCost: parsed.data.partsCost ?? 0,
        laborCost: parsed.data.laborCost ?? 0,
      },
      include: { vehicle: { select: vehicleSelect } },
    });
    return reply.status(201).send(toMaintenanceOrderDto(order));
  });

  app.get("/maintenance/reminders", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const reminders = await prisma.maintenanceReminder.findMany({
      where: { vehicleId: { in: vehicleIds } },
      include: { vehicle: { select: vehicleSelect } },
    });
    return reminders.map((r) => toMaintenanceReminderDto(r, isReminderDueSoon(r)));
  });

  app.post("/maintenance/reminders", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      service: z.string().min(1),
      intervalKm: z.number().optional(),
      intervalDays: z.number().optional(),
      lastDoneAt: z.string().datetime().optional(),
      lastDoneKm: z.number().optional(),
      alertDaysBefore: z.number().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const reminder = await prisma.maintenanceReminder.create({
      data: {
        vehicleId: parsed.data.vehicleId,
        service: parsed.data.service,
        intervalKm: parsed.data.intervalKm ?? null,
        intervalDays: parsed.data.intervalDays ?? null,
        lastDoneAt: parsed.data.lastDoneAt ? new Date(parsed.data.lastDoneAt) : null,
        lastDoneKm: parsed.data.lastDoneKm ?? null,
        alertDaysBefore: parsed.data.alertDaysBefore ?? 7,
      },
      include: { vehicle: { select: vehicleSelect } },
    });
    return reply.status(201).send(toMaintenanceReminderDto(reminder, false));
  });

  // --- Checklist ---
  app.get("/checklists/templates", auth, async (request) => {
    const templates = await prisma.checklistTemplate.findMany({
      where: { organizationId: request.authUser!.organizationId, active: true },
    });
    return templates.map(toChecklistTemplateDto);
  });

  app.post("/checklists/templates", auth, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      items: z.array(z.object({ label: z.string(), required: z.boolean() })).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const template = await prisma.checklistTemplate.create({
      data: {
        organizationId: request.authUser!.organizationId,
        name: parsed.data.name,
        items: parsed.data.items ?? DEFAULT_CHECKLIST_ITEMS,
      },
    });
    return reply.status(201).send(toChecklistTemplateDto(template));
  });

  app.get("/checklists/entries", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const entries = await prisma.checklistEntry.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: {
        vehicle: { select: vehicleSelect },
        driver: { select: driverSelect },
        template: { select: { id: true, name: true } },
      },
    });
    return entries.map(toChecklistEntryDto);
  });

  app.post("/checklists/entries", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      driverId: z.string().optional(),
      templateId: z.string(),
      answers: z.record(z.union([z.boolean(), z.string()])),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const entry = await prisma.checklistEntry.create({
      data: parsed.data,
      include: {
        vehicle: { select: vehicleSelect },
        driver: { select: driverSelect },
        template: { select: { id: true, name: true } },
      },
    });
    return reply.status(201).send(toChecklistEntryDto(entry));
  });

  // --- Fines ---
  app.get("/fines", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const fines = await prisma.vehicleFine.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: vehicleSelect }, driver: { select: driverSelect } },
    });
    return fines.map(toVehicleFineDto);
  });

  app.post("/fines", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      driverId: z.string().optional(),
      description: z.string().min(1),
      amount: z.number().positive(),
      dueDate: z.string().datetime().optional(),
      location: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const fine = await prisma.vehicleFine.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
      include: { vehicle: { select: vehicleSelect }, driver: { select: driverSelect } },
    });
    return reply.status(201).send(toVehicleFineDto(fine));
  });

  app.patch<{ Params: { id: string }; Body: { status: string; paidAt?: string } }>(
    "/fines/:id",
    auth,
    async (request, reply) => {
      const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
      const fine = await prisma.vehicleFine.findFirst({
        where: { id: request.params.id, vehicleId: { in: vehicleIds } },
      });
      if (!fine) return reply.status(404).send({ error: "Multa não encontrada" });

      const updated = await prisma.vehicleFine.update({
        where: { id: fine.id },
        data: {
          status: request.body.status as "PENDING" | "PAID" | "CONTESTED",
          paidAt: request.body.paidAt ? new Date(request.body.paidAt) : undefined,
        },
        include: { vehicle: { select: vehicleSelect }, driver: { select: driverSelect } },
      });
      return toVehicleFineDto(updated);
    },
  );

  // --- Expenses ---
  app.get("/expenses", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const expenses = await prisma.vehicleExpense.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: vehicleSelect } },
    });
    return expenses.map(toVehicleExpenseDto);
  });

  app.post("/expenses", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      category: z.enum([
        "IPVA",
        "INSURANCE",
        "LICENSE",
        "RENT",
        "FINANCING",
        "TRAVEL",
        "DOCUMENT",
        "OTHER",
      ]),
      description: z.string().min(1),
      amount: z.number().positive(),
      dueDate: z.string().datetime().optional(),
      paidAt: z.string().datetime().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: request.authUser!.organizationId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    const expense = await prisma.vehicleExpense.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      },
      include: { vehicle: { select: vehicleSelect } },
    });
    return reply.status(201).send(toVehicleExpenseDto(expense));
  });
}
