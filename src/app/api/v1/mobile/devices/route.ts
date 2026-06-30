import { handleMobileApi } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { registerPushToken, unregisterPushToken } from "@/lib/mobile/devices";
import { registerDeviceSchema } from "@/lib/validations/mobile";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/devices — register/update this device's push token.
export async function POST(request: Request) {
  return handleMobileApi(request, async (ctx, req) => {
    const body = await req.json().catch(() => null);
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "invalid_request", "Invalid device payload");

    const res = await registerPushToken(ctx.restaurantId, ctx.deviceId, parsed.data.pushToken, parsed.data.platform);
    if (!res.ok) return apiError(404, "not_found", res.error);
    return ok({ registered: true });
  });
}

// DELETE /api/v1/mobile/devices — stop receiving push on this device.
export async function DELETE(request: Request) {
  return handleMobileApi(request, async (ctx) => {
    const res = await unregisterPushToken(ctx.restaurantId, ctx.deviceId);
    if (!res.ok) return apiError(404, "not_found", res.error);
    return ok({ unregistered: true });
  });
}
