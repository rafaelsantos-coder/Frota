import { prisma } from "./prisma.js";
import { hashPassword } from "./auth.js";
import { ensureNotificationDefaults } from "./notifications.js";
import { DEFAULT_CHECKLIST_ITEMS, PERMISSIONS, type Permission } from "@frota/shared";

const ALL_PERMISSIONS = [...PERMISSIONS] as Permission[];

const DEFAULT_PROFILES: Array<{
  name: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    name: "Administrador",
    description: "Acesso total ao sistema",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Operador",
    description: "Monitoramento e operações do dia a dia",
    permissions: [
      "monitoring.view",
      "vehicles.view",
      "drivers.view",
      "drivers.manage",
      "operations.view",
      "operations.manage",
      "reports.view",
    ],
  },
  {
    name: "Visualizador",
    description: "Somente leitura",
    permissions: ["monitoring.view", "vehicles.view", "drivers.view", "operations.view", "reports.view"],
  },
];

async function ensureAccessProfiles(organizationId: string) {
  for (const def of DEFAULT_PROFILES) {
    const existing = await prisma.accessProfile.findFirst({
      where: { organizationId, name: def.name },
    });
    if (!existing) {
      await prisma.accessProfile.create({
        data: {
          organizationId,
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          isSystem: true,
        },
      });
    }
  }
  return prisma.accessProfile.findFirst({
    where: { organizationId, name: "Administrador" },
  });
}

export async function getDefaultOrganization() {
  let org = await prisma.organization.findFirst({ where: { slug: "principal" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Sulnet", slug: "principal" },
    });
  }
  return org;
}

export async function ensureSeedData() {
  const org = await getDefaultOrganization();
  await ensureAccessProfiles(org.id);
  const adminProfile = await prisma.accessProfile.findFirst({
    where: { organizationId: org.id, name: "Administrador" },
  });

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@sulnet.com";
    const password = process.env.ADMIN_PASSWORD ?? "Sulnet@2026";
    const name = process.env.ADMIN_NAME ?? "Administrador";

    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: "ADMIN",
        profileId: adminProfile?.id ?? null,
        passwordHash: await hashPassword(password),
        organizationId: org.id,
      },
    });

    console.log(`[seed] Admin criado: ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[seed] ADMIN_PASSWORD não definido — usando senha padrão Sulnet@2026. Altere no Railway!");
    }
  }

  await ensureNotificationDefaults(org.id, process.env.ADMIN_EMAIL);

  const jimiCount = await prisma.jimiIntegration.count({ where: { organizationId: org.id } });
  if (jimiCount === 0) {
    await prisma.jimiIntegration.create({
      data: {
        organizationId: org.id,
        label: "Jimi IoT Hub (JC371)",
        enabled: false,
      },
    });
  }

  const gt06Count = await prisma.gt06Integration.count({ where: { organizationId: org.id } });
  if (gt06Count === 0) {
    await prisma.gt06Integration.create({
      data: {
        organizationId: org.id,
        label: "Servidor GT06",
        host: process.env.GT06_PUBLIC_HOST ?? "localhost",
        port: Number(process.env.GT06_PORT ?? 5023),
        enabled: true,
      },
    });
  }

  const checklistCount = await prisma.checklistTemplate.count({
    where: { organizationId: org.id },
  });
  if (checklistCount === 0) {
    await prisma.checklistTemplate.create({
      data: {
        organizationId: org.id,
        name: "Checklist diário padrão",
        items: DEFAULT_CHECKLIST_ITEMS,
      },
    });
  }
}
