import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toUserDto, verifyPassword } from "../lib/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "E-mail ou senha inválidos" });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { organization: true },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      token,
      user: toUserDto(user),
    };
  });

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.authUser!.sub },
        include: { organization: true },
      });
      return toUserDto(user);
    },
  );
}
