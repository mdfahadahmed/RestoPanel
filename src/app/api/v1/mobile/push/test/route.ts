import { handleMobileApi } from "@/lib/mobile/gateway";
import { ok } from "@/lib/api/respond";
import { sendPushToUser } from "@/lib/mobile/push";
import { pushTestSchema } from "@/lib/validations/mobile";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/push/test — send a test push to the caller's own devices.
export async function POST(request: Request) {
  return handleMobileApi(request, async (ctx, req) => {
    const body = await req.json().catch(() => ({}));
    const parsed = pushTestSchema.safeParse(body ?? {});
    const title = parsed.success && parsed.data.title ? parsed.data.title : "Test notification";
    const msg = parsed.success && parsed.data.body ? parsed.data.body : "Push notifications are working.";

    return ok(await sendPushToUser(ctx.restaurantId, ctx.userId, { title, body: msg }));
  });
}
