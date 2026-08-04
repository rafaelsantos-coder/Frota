import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  organizationId: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function toUserDto(user: {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  organizationId: string;
  organization: { name: string };
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const payload = (await request.jwtVerify()) as AuthUser;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Sessão inválida" });
    }

    request.authUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  } catch {
    return reply.status(401).send({ error: "Não autenticado" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.authUser) {
    return reply.status(401).send({ error: "Não autenticado" });
  }
  if (request.authUser.role !== "ADMIN") {
    return reply.status(403).send({ error: "Acesso restrito a administradores" });
  }
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}
