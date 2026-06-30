import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Append-only audit trail for security-relevant actions. Best-effort: recording
 * an audit entry must never break the action it describes.
 */

export interface AuditInput {
  restaurantId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string; // e.g. "2fa.enable", "session.revoke", "apikey.create"
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  } catch {
    /* never throw from the audit path */
  }
}

export async function listAudit(restaurantId: string, opts: { action?: string; limit?: number } = {}) {
  return prisma.auditLog.findMany({
    where: { restaurantId, ...(opts.action ? { action: opts.action } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, opts.limit ?? 100), 500),
  });
}
