import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

export type AuditInput = {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
};

export function clientIp(request: FastifyRequest): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return request.ip;
}

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        userName: input.userName ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        details: (input.details ?? {}) as object,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log", error);
  }
}

export async function auditFromRequest(
  request: FastifyRequest,
  action: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  if (!request.authUser) return;
  await writeAuditLog({
    organizationId: request.authUser.organizationId,
    userId: request.authUser.sub,
    userEmail: request.authUser.email,
    userName: request.authUser.name,
    action,
    entity,
    entityId,
    details,
    ip: clientIp(request),
  });
}

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  PROFILE_CREATE: "PROFILE_CREATE",
  PROFILE_UPDATE: "PROFILE_UPDATE",
  PROFILE_DELETE: "PROFILE_DELETE",
  VEHICLE_CREATE: "VEHICLE_CREATE",
  VEHICLE_UPDATE: "VEHICLE_UPDATE",
  VEHICLE_DELETE: "VEHICLE_DELETE",
} as const;

export async function logLoginSuccess(
  request: FastifyRequest,
  user: { id: string; email: string; name: string; organizationId: string },
) {
  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: AUDIT_ACTIONS.LOGIN,
    entity: "user",
    entityId: user.id,
    ip: clientIp(request),
  });
}
