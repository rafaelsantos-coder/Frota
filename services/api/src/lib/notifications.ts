import { prisma } from "./prisma.js";

export async function notifyCriticalAlert(alert: {
  type: string;
  label: string;
  severity: string;
  vehicleId: string | null;
  organizationId?: string;
}) {
  if (!["CRITICAL", "HIGH"].includes(alert.severity)) return;

  let orgId = alert.organizationId;
  if (!orgId && alert.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: alert.vehicleId },
      select: { organizationId: true },
    });
    if (!vehicle) return;
    orgId = vehicle.organizationId;
  }
  if (!orgId) return;

  const prefs = await prisma.notificationPreference.findMany({ where: { organizationId: orgId } });
  for (const pref of prefs) {
    if (alert.severity === "CRITICAL" && !pref.onCritical) continue;
    if (alert.severity === "HIGH" && !pref.onHigh) continue;
    if (pref.email) {
      console.log(
        `[notify] email=${pref.email} severity=${alert.severity} type=${alert.type} label=${alert.label}`,
      );
    }
  }
}

export async function ensureNotificationDefaults(organizationId: string, email?: string) {
  const existing = await prisma.notificationPreference.findFirst({ where: { organizationId } });
  if (!existing) {
    await prisma.notificationPreference.create({
      data: { organizationId, email: email ?? null, onCritical: true, onHigh: true },
    });
  }
}
