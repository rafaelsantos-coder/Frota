import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Permission } from "@frota/shared";
import { PERMISSIONS } from "@frota/shared";
import { prisma } from "../lib/prisma.js";
import { hashPassword, requireAdmin } from "../lib/auth.js";
import { auditFromRequest, AUDIT_ACTIONS } from "../lib/audit.js";

const permissionSchema = z.enum(PERMISSIONS as unknown as [Permission, ...Permission[]]);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "OPERATOR"]).optional(),
  profileId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "OPERATOR"]).optional(),
  profileId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const profileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(permissionSchema).min(1),
});

function toAdminUserDto(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  profileId: string | null;
  organizationId: string;
  organization: { name: string };
  profile: { name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    profileId: user.profileId,
    profileName: user.profile?.name ?? null,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}

function toProfileDto(profile: {
  id: string;
  name: string;
  description: string | null;
  permissions: unknown;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number };
}) {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    permissions: profile.permissions as Permission[],
    isSystem: profile.isSystem,
    userCount: profile._count?.users,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function registerAdminRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.authenticate, requireAdmin] };

  app.get("/admin/users", admin, async (request) => {
    const users = await prisma.user.findMany({
      where: { organizationId: request.authUser!.organizationId },
      include: { organization: true, profile: true },
      orderBy: { name: "asc" },
    });
    return users.map(toAdminUserDto);
  });

  app.post("/admin/users", admin, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const orgId = request.authUser!.organizationId;
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (existing) {
      return reply.status(409).send({ error: "E-mail já cadastrado" });
    }

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role ?? "OPERATOR",
        profileId: parsed.data.profileId ?? null,
        active: parsed.data.active ?? true,
        organizationId: orgId,
      },
      include: { organization: true, profile: true },
    });

    await auditFromRequest(request, AUDIT_ACTIONS.USER_CREATE, "user", user.id, {
      email: user.email,
      role: user.role,
    });

    return reply.status(201).send(toAdminUserDto(user));
  });

  app.patch<{ Params: { id: string } }>("/admin/users/:id", admin, async (request, reply) => {
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.user.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Usuário não encontrado" });
    }

    if (existing.id === request.authUser!.sub && parsed.data.active === false) {
      return reply.status(400).send({ error: "Você não pode desativar sua própria conta" });
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: parsed.data.email?.toLowerCase(),
        name: parsed.data.name,
        role: parsed.data.role,
        profileId: parsed.data.profileId,
        active: parsed.data.active,
        ...(parsed.data.password
          ? { passwordHash: await hashPassword(parsed.data.password) }
          : {}),
      },
      include: { organization: true, profile: true },
    });

    await auditFromRequest(request, AUDIT_ACTIONS.USER_UPDATE, "user", user.id, {
      email: user.email,
      active: user.active,
    });

    return toAdminUserDto(user);
  });

  app.get("/admin/profiles", admin, async (request) => {
    const profiles = await prisma.accessProfile.findMany({
      where: { organizationId: request.authUser!.organizationId },
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return profiles.map(toProfileDto);
  });

  app.post("/admin/profiles", admin, async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const profile = await prisma.accessProfile.create({
      data: {
        organizationId: request.authUser!.organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        permissions: parsed.data.permissions,
      },
      include: { _count: { select: { users: true } } },
    });

    await auditFromRequest(request, AUDIT_ACTIONS.PROFILE_CREATE, "profile", profile.id, {
      name: profile.name,
    });

    return reply.status(201).send(toProfileDto(profile));
  });

  app.patch<{ Params: { id: string } }>("/admin/profiles/:id", admin, async (request, reply) => {
    const parsed = profileSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.accessProfile.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Perfil não encontrado" });
    }

    const profile = await prisma.accessProfile.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions,
      },
      include: { _count: { select: { users: true } } },
    });

    await auditFromRequest(request, AUDIT_ACTIONS.PROFILE_UPDATE, "profile", profile.id);

    return toProfileDto(profile);
  });

  app.delete<{ Params: { id: string } }>("/admin/profiles/:id", admin, async (request, reply) => {
    const existing = await prisma.accessProfile.findFirst({
      where: {
        id: request.params.id,
        organizationId: request.authUser!.organizationId,
      },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Perfil não encontrado" });
    }
    if (existing.isSystem) {
      return reply.status(400).send({ error: "Perfis do sistema não podem ser excluídos" });
    }
    if (existing._count.users > 0) {
      return reply.status(400).send({ error: "Perfil possui usuários vinculados" });
    }

    await prisma.accessProfile.delete({ where: { id: existing.id } });
    await auditFromRequest(request, AUDIT_ACTIONS.PROFILE_DELETE, "profile", existing.id);

    return reply.status(204).send();
  });

  app.get("/admin/audit-logs", admin, async (request) => {
    const query = request.query as { limit?: string; action?: string };
    const limit = Math.min(Number(query.limit ?? 100), 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: request.authUser!.organizationId,
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userEmail: log.userEmail,
      userName: log.userName,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details as Record<string, unknown>,
      ip: log.ip,
      createdAt: log.createdAt.toISOString(),
    }));
  });
}
