import { verifyCronRequest } from "@/lib/cron";
import { log } from "@/lib/log";
import { captureError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/cron/backup — daily database-backup trigger, run by Vercel Cron
 * (see vercel.json) and guarded by CRON_SECRET. Serverless can't run pg_dump
 * directly, so this fires the configured backup job (BACKUP_WEBHOOK_URL) — e.g.
 * a managed-Postgres snapshot or a GitHub Action running scripts/backup-db.ts —
 * and records the run. Returns 401 when the secret is missing/invalid.
 */
async function handle(request: Request) {
  const auth = verifyCronRequest(request.headers);
  if (!auth.allowed) {
    return Response.json({ error: { code: "unauthorized", message: auth.reason ?? "Unauthorized" } }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const webhook = process.env.BACKUP_WEBHOOK_URL;
  let triggered = false;

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "daily_backup", startedAt }),
      });
      triggered = res.ok;
    } catch (e) {
      await captureError(e, { job: "daily_backup" });
    }
  }

  log.info("daily backup triggered", { startedAt, triggered, configured: Boolean(webhook) });
  return Response.json({ ok: true, job: "daily_backup", startedAt, triggered });
}

export const GET = handle;
export const POST = handle;
