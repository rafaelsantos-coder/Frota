import { prisma } from "./prisma.js";

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[notify] telegram failed: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error("[notify] telegram error", error);
  }
}

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

    const message = `[${alert.severity}] ${alert.label} (${alert.type})`;

    if (pref.email) {
      console.log(`[notify] email=${pref.email} ${message}`);
    }

    if (pref.onTelegram && pref.telegramChatId) {
      await sendTelegram(pref.telegramChatId, `<b>Sulnet Frota</b>\n${message}`);
    }
  }
}

export async function ensureNotificationDefaults(organizationId: string, email?: string) {
  const existing = await prisma.notificationPreference.findFirst({ where: { organizationId } });
  if (!existing) {
    await prisma.notificationPreference.create({
      data: {
        organizationId,
        email: email ?? null,
        onCritical: true,
        onHigh: true,
        onTelegram: false,
      },
    });
  }
}
