import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Generic fixed-window rate limiter keyed by an arbitrary bucket string (e.g.
 * "login:ip:1.2.3.4"). Postgres-backed, no Redis — the same approach as the
 * API-key limiter but not tied to an ApiKey, so it can throttle logins, password
 * resets, etc.
 */

const WINDOW_MS = 60_000;

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  count: number;
}

export async function checkRateLimit(bucket: string, limit: number, now: number = Date.now()): Promise<RateResult> {
  const windowStart = Math.floor(now / WINDOW_MS);
  const reset = (windowStart + 1) * WINDOW_MS;

  let count: number;
  try {
    const row = await prisma.securityRateWindow.upsert({
      where: { bucket_windowStart: { bucket, windowStart } },
      create: { bucket, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    count = row.count;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.securityRateWindow.update({
        where: { bucket_windowStart: { bucket, windowStart } },
        data: { count: { increment: 1 } },
      });
      count = row.count;
    } else {
      throw e;
    }
  }

  // Opportunistically prune stale windows for this bucket.
  prisma.securityRateWindow
    .deleteMany({ where: { bucket, windowStart: { lt: windowStart - 1 } } })
    .catch(() => undefined);

  return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), reset, count };
}

/** Clear a bucket's windows (e.g. after a successful login). */
export async function resetRateLimit(bucket: string): Promise<void> {
  await prisma.securityRateWindow.deleteMany({ where: { bucket } }).catch(() => undefined);
}
