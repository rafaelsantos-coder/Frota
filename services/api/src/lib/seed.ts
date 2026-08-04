import { prisma } from "./prisma.js";

export async function ensureSeedData() {
  const jimiCount = await prisma.jimiIntegration.count();
  if (jimiCount === 0) {
    await prisma.jimiIntegration.create({
      data: {
        label: "Jimi IoT Hub (JC371)",
        enabled: false,
      },
    });
  }

  const gt06Count = await prisma.gt06Integration.count();
  if (gt06Count === 0) {
    await prisma.gt06Integration.create({
      data: {
        label: "Servidor GT06",
        host: process.env.GT06_PUBLIC_HOST ?? "localhost",
        port: Number(process.env.GT06_PORT ?? 5023),
        enabled: true,
      },
    });
  }
}
