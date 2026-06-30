import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

// GET /api/health — liveness + database readiness probe for uptime monitors and
// the deploy platform. Returns 200 when healthy, 503 when a check fails.
export async function GET() {
  const report = await checkHealth();
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
