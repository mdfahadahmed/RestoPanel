import { mobileResponse } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { logoutMobile } from "@/lib/mobile/auth";
import { mobileRefreshSchema } from "@/lib/validations/mobile";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/auth/logout — revoke the device session.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = mobileRefreshSchema.safeParse(body);
  if (!parsed.success) return mobileResponse(apiError(400, "invalid_request", "Invalid logout payload"));

  const res = await logoutMobile(parsed.data.refreshToken);
  return mobileResponse(ok({ revoked: res.ok }));
}
