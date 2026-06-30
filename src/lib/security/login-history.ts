import { prisma } from "@/lib/prisma";

/**
 * Login history — every authentication attempt (success and failure) so users
 * and operators can spot suspicious access. Recording is best-effort.
 */

export interface LoginEventInput {
  restaurantId?: string | null;
  userId?: string | null;
  email: string;
  method: "password" | "mobile" | "totp" | "passkey";
  success: boolean;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordLogin(input: LoginEventInput): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: {
        restaurantId: input.restaurantId ?? null,
        userId: input.userId ?? null,
        email: input.email,
        method: input.method,
        success: input.success,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch {
    /* never throw from the login-history path */
  }
}

export async function listLogins(
  restaurantId: string,
  opts: { userId?: string; limit?: number } = {}
) {
  return prisma.loginEvent.findMany({
    where: { restaurantId, ...(opts.userId ? { userId: opts.userId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, opts.limit ?? 50), 200),
  });
}

/** Count recent failed attempts for an email (for lockout / anomaly checks). */
export async function recentFailures(email: string, sinceMs: number): Promise<number> {
  return prisma.loginEvent.count({
    where: { email: email.toLowerCase(), success: false, createdAt: { gte: new Date(Date.now() - sinceMs) } },
  });
}
