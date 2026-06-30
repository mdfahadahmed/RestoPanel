import { mobileResponse } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { refreshMobile } from "@/lib/mobile/auth";
import { mobileRefreshSchema } from "@/lib/validations/mobile";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/auth/refresh — rotate the refresh token, mint a new access token.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = mobileRefreshSchema.safeParse(body);
  if (!parsed.success) return mobileResponse(apiError(400, "invalid_request", "Invalid refresh payload"));

  const res = await refreshMobile(parsed.data.refreshToken);
  if (!res.ok) return mobileResponse(apiError(401, "unauthorized", res.error));
  return mobileResponse(ok({ accessToken: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn }));
}
