import { prisma } from "./prisma.js";
import { hashPassword } from "./auth.js";

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
        passwordHash: await hashPassword(password),
        organizationId: org.id,
      },
    });

    console.log(`[seed] Admin criado: ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[seed] ADMIN_PASSWORD não definido — usando senha padrão Sulnet@2026. Altere no Railway!");
    }
  }

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
}
