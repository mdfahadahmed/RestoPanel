import { prisma } from "@/lib/prisma";

/**
 * Health probe for load balancers, uptime monitors and the deploy platform.
 * Reports process liveness plus a real database round-trip so a healthy 200
 * means "this instance can actually serve requests".
 */

export interface HealthReport {
  status: "ok" | "degraded";
  time: string;
  uptimeSeconds: number;
  version: string;
  checks: {
    database: { ok: boolean; latencyMs: number; error?: string };
  };
}

const startedAt = Date.now();

/** Round-trip the database with a trivial query; returns latency or the error. */
export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : "db error" };
  }
}

export async function checkHealth(): Promise<HealthReport> {
  const database = await checkDatabase();
  return {
    status: database.ok ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || "dev",
    checks: { database },
  };
}
