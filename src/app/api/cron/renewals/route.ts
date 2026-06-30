import { verifyCronRequest } from "@/lib/cron";
import { log } from "@/lib/log";
import { captureError } from "@/lib/monitoring";
import { processRenewals } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/cron/renewals — advance subscription billing periods. Run by
 * Vercel Cron (vercel.json) and guarded by CRON_SECRET. Mirrors the existing
 * `scripts/process-renewals.ts` job so it can run on the platform schedule.
 */
async function handle(request: Request) {
  const auth = verifyCronRequest(request.headers);
  if (!auth.allowed) {
    return Response.json({ error: { code: "unauthorized", message: auth.reason ?? "Unauthorized" } }, { status: 401 });
  }
  try {
    const summary = await processRenewals(new Date());
    log.info("renewals processed", { ...summary });
    return Response.json({ ok: true, job: "renewals", ...summary });
  } catch (e) {
    await captureError(e, { job: "renewals" });
    return Response.json({ error: { code: "internal_error", message: "Renewals job failed" } }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
