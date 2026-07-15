import { prisma } from "@/lib/prisma";

/**
 * Customer-account login history — every authentication attempt (success and
 * failure) so a customer can review recent activity from their account. Kept
 * separate from the staff/owner `LoginEvent` because customer accounts are
 * cross-tenant. Recording is best-effort and never throws.
 */

export interface CustomerLoginInput {
  accountId?: string | null;
  email: string;
  method?: "password" | "reset";
  success: boolean;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordCustomerLogin(input: CustomerLoginInput): Promise<void> {
  try {
    await prisma.customerLoginEvent.create({
      data: {
        accountId: input.accountId ?? null,
        email: input.email.toLowerCase(),
        method: input.method ?? "password",
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

/** Recent login activity for an account (newest first), for the security view. */
export function listCustomerLogins(accountId: string, limit = 20) {
  return prisma.customerLoginEvent.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 100),
  });
}
