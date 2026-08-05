import { prisma } from "./prisma.js";

export async function resolveDriverForVehicle(vehicleId: string, organizationId: string) {
  const assignment = await prisma.driverAssignment.findFirst({
    where: { vehicleId, endedAt: null },
    include: { driver: true },
    orderBy: { startedAt: "desc" },
  });
  if (assignment?.driver.organizationId === organizationId) {
    return assignment.driver;
  }
  return null;
}

export async function resolveDriverByRfid(rfidTag: string, organizationId: string) {
  return prisma.driver.findFirst({
    where: { organizationId, rfidTag, active: true },
  });
}

export async function assignDriverToVehicle(driverId: string, vehicleId: string) {
  await prisma.driverAssignment.updateMany({
    where: { vehicleId, endedAt: null },
    data: { endedAt: new Date() },
  });
  await prisma.driverAssignment.updateMany({
    where: { driverId, endedAt: null },
    data: { endedAt: new Date() },
  });
  return prisma.driverAssignment.create({
    data: { driverId, vehicleId },
  });
}

export async function getCurrentVehicleForDriver(driverId: string) {
  const assignment = await prisma.driverAssignment.findFirst({
    where: { driverId, endedAt: null },
    include: { vehicle: { select: { id: true, plate: true, label: true } } },
    orderBy: { startedAt: "desc" },
  });
  return assignment?.vehicle ?? null;
}

export async function orgVehicleIds(organizationId: string) {
  return (
    await prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((v) => v.id);
}

export async function orgDriverIds(organizationId: string) {
  return (
    await prisma.driver.findMany({
      where: { organizationId, active: true },
      select: { id: true },
    })
  ).map((d) => d.id);
}

const vehicleSelect = { id: true, plate: true, label: true } as const;
const driverSelect = { id: true, name: true } as const;

export { vehicleSelect, driverSelect };
