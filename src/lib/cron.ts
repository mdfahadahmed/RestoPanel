/**
 * Shared guard for scheduled (cron) routes. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; we also accept an `x-cron-secret`
 * header for other schedulers. When no secret is configured the route is
 * refused in production and allowed in development (so local testing works).
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function cronSecretFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = headers.get("x-cron-secret");
  return x ? x.trim() : null;
}

export interface CronAuth {
  allowed: boolean;
  reason?: string;
}

/** Verify a cron request against `CRON_SECRET`. */
export function verifyCronRequest(headers: Headers, secret = process.env.CRON_SECRET): CronAuth {
  if (!secret) {
    return process.env.NODE_ENV === "production"
      ? { allowed: false, reason: "CRON_SECRET not configured" }
      : { allowed: true };
  }
  const provided = cronSecretFromHeaders(headers);
  if (!provided) return { allowed: false, reason: "Missing cron secret" };
  return timingSafeEqual(provided, secret)
    ? { allowed: true }
    : { allowed: false, reason: "Invalid cron secret" };
}
