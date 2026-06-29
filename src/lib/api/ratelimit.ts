import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiting, backed by Postgres (no Redis). One counter row per
 * key per minute; the row is incremented atomically. Old windows are pruned
 * opportunistically so the table stays tiny.
 */

const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the current window resets. */
  reset: number;
  count: number;
}

export async function checkRateLimit(
  apiKeyId: string,
  limit: number,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / WINDOW_MS); // epoch-minute bucket
  const reset = (windowStart + 1) * WINDOW_MS;

  let count: number;
  try {
    const row = await prisma.apiRateWindow.upsert({
      where: { apiKeyId_windowStart: { apiKeyId, windowStart } },
      create: { apiKeyId, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    count = row.count;
  } catch (e) {
    // Two concurrent creates can race the unique constraint — fall back to a
    // plain atomic increment.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.apiRateWindow.update({
        where: { apiKeyId_windowStart: { apiKeyId, windowStart } },
        data: { count: { increment: 1 } },
      });
      count = row.count;
    } else {
      throw e;
    }
  }

  // Prune stale windows for this key (fire-and-forget).
  prisma.apiRateWindow
    .deleteMany({ where: { apiKeyId, windowStart: { lt: windowStart - 1 } } })
    .catch(() => undefined);

  const remaining = Math.max(0, limit - count);
  return { allowed: count <= limit, limit, remaining, reset, count };
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.reset / 1000)),
  };
}
