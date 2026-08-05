import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { orgVehicleIds, vehicleSelect, driverSelect } from "../lib/drivers.js";
import { isReminderDueSoon } from "../lib/geo.js";
import {
  toChecklistEntryDto,
  toChecklistTemplateDto,
  toFuelEntryDto,
  toFuelStationDto,
  toMaintenanceOrderDto,
  toMaintenanceReminderDto,
  toVehicleExpenseDto,
  toVehicleFineDto,
} from "../lib/mappers.js";
import { DEFAULT_CHECKLIST_ITEMS } from "@frota/shared";
import { parseFuelCsv } from "../lib/fuel-csv-import.js";

function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function registerOperationsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // --- Fuel stations ---
  app.get("/fuel-stations", auth, async (request) => {
    const orgId = request.authUser!.organizationId;
    const stations = await prisma.fuelStation.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: { _count: { select: { fuelEntries: true } } },
    });
    return stations.map(toFuelStationDto);
  });

  app.post("/fuel-stations", auth, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      cnpj: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const orgId = request.authUser!.organizationId;
    try {
      const station = await prisma.fuelStation.create({
        data: { organizationId: orgId, ...parsed.data },
        include: { _count: { select: { fuelEntries: true } } },
      });
      return reply.status(201).send(toFuelStationDto(station));
    } catch {
      return reply.status(409).send({ error: "Já existe um posto com este nome" });
    }
  });

  app.patch("/fuel-stations/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      cnpj: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      active: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const orgId = request.authUser!.organizationId;
    const existing = await prisma.fuelStation.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return reply.status(404).send({ error: "Posto não encontrado" });

    const station = await prisma.fuelStation.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { fuelEntries: true } } },
    });
    return toFuelStationDto(station);
  });

  app.delete("/fuel-stations/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = request.authUser!.organizationId;
    const existing = await prisma.fuelStation.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return reply.status(404).send({ error: "Posto não encontrado" });
    await prisma.fuelStation.delete({ where: { id } });
    return reply.status(204).send();
  });

  // --- Fuel ---
  app.get("/fuel-entries", auth, async (request) => {
    const vehicleIds = await orgVehicleIds(request.authUser!.organizationId);
    const entries = await prisma.fuelEntry.findMany({
      where: { vehicleId: { in: vehicleIds } },
      orderBy: { recordedAt: "desc" },
      take: 200,
      include: {
        vehicle: { select: vehicleSelect },
        driver: { select: driverSelect },
        fuelStation: { select: { id: true, name: true } },
      },
    });
    return entries.map(toFuelEntryDto);
  });

  app.post("/fuel-entries", auth, async (request, reply) => {
    const schema = z.object({
      vehicleId: z.string(),
      driverId: z.string().optional(),
      stationId: z.string().optional(),
      liters: z.number().positive(),
      amountPaid: z.number().nonnegative(),
      odometerKm: z.number().optional(),
      station: z.string().optional(),
      recordedAt: z.string().datetime(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const orgId = request.authUser!.organizationId;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, organizationId: orgId },
    });
    if (!vehicle) return reply.status(404).send({ error: "Veículo não encontrado" });

    let stationName = parsed.data.station ?? null;
    if (parsed.data.stationId) {
      const fuelStation = await prisma.fuelStation.findFirst({
        where: { id: parsed.data.stationId, organizationId: orgId },
      });
      if (!fuelStation) return reply.status(404).send({ error: "Posto não encontrado" });
      stationName = fuelStation.name;
    }

    const entry = await prisma.fuelEntry.create({
      data: {
        vehicleId: parsed.data.vehicleId,
        driverId: parsed.data.driverId,
        stationId: parsed.data.stationId,
        liters: parsed.data.liters,
        amountPaid: parsed.data.amountPaid,
        odometerKm: parsed.data.odometerKm,
        station: stationName,
        recordedAt: new Date(parsed.data.recordedAt),
      },
      include: {
        vehicle: { select: vehicleSelect },
        driver: { select: driverSelect },
        fuelStation: { select: { id: true, name: true } },
      },
    });
    return reply.status(201).send(toFuelEntryDto(entry));
  });

  app.post("/fuel-entries/import-csv", auth, async (request, reply) => {
    const schema = z.object({
      csv: z.string().min(1),
      defaultStationId: z.string().optional(),
      createStations: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const orgId = request.authUser!.organizationId;
    const { csv, defaultStationId, createStations } = parsed.data;
    const { rows, errors } = parseFuelCsv(csv);
    if (rows.length === 0) {
      return reply.status(400).send({
        imported: 0,
        skipped: 0,
        stationsCreated: 0,
        errors: errors.length ? errors : [{ line: 0, message: "Nenhuma linha válida no CSV" }],
      });
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: orgId },
      select: { id: true, plate: true },
    });
    const plateMap = new Map(vehicles.map((v) => [normalizePlate(v.plate), v.id]));

    const stations = await prisma.fuelStation.findMany({ where: { organizationId: orgId } });
    const stationByName = new Map(stations.map((s) => [s.name.trim().toLowerCase(), s]));
    let stationsCreated = 0;

    async function resolveStationId(name?: string): Promise<{ id: string | null; label: string | null }> {
      if (defaultStationId) {
        const def = stations.find((s) => s.id === defaultStationId);
        return { id: defaultStationId, label: def?.name ?? null };
      }
      if (!name) return { id: null, label: null };
      const key = name.trim().toLowerCase();
      let station = stationByName.get(key);
      if (!station && createStations) {
        station = await prisma.fuelStation.create({
          data: { organizationId: orgId, name: name.trim() },
        });
        stationByName.set(key, station);
        stationsCreated++;
      }
      return station ? { id: station.id, label: station.name } : { id: null, label: name.trim() };
    }

    let imported = 0;
    for (const row of rows) {
      const vehicleId = plateMap.get(row.plate);
      if (!vehicleId) {
        errors.push({ line: row.line, message: `Veículo não encontrado: ${row.plate}` });
        continue;
      }
      const station = await resolveStationId(row.stationName);
      await prisma.fuelEntry.create({
        data: {
          vehicleId,
          stationId: station.id,
          station: station.label,
          liters: row.liters,
          amountPaid: row.amountPaid,
          odometerKm: row.odometerKm,
          recordedAt: row.recordedAt,
        },
      });
      imported++;
    }

    return {
      imported,
      skipped: rows.length - imported,
      stationsCreated,
      errors,
    };
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
