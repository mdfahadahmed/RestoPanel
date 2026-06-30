import { handleMobileApi } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { getSyncDelta } from "@/lib/mobile/sync";

export const dynamic = "force-dynamic";

// GET /api/v1/mobile/sync?since=<ISO>&limit=<n> — delta sync for the offline cache.
export async function GET(request: Request) {
  return handleMobileApi(request, async (ctx, req) => {
    const sp = new URL(req.url).searchParams;
    const sinceRaw = sp.get("since");
    let since: Date | null = null;
    if (sinceRaw) {
      since = new Date(sinceRaw);
      if (Number.isNaN(since.getTime())) return apiError(400, "invalid_request", "Invalid 'since' cursor");
    }
    const limitRaw = Number(sp.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

    return ok(await getSyncDelta(ctx.restaurantId, since, limit));
  });
}
