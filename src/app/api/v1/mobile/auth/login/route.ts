import { mobileResponse } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { loginMobile } from "@/lib/mobile/auth";
import { mobileLoginSchema } from "@/lib/validations/mobile";
import { getClientIp } from "@/lib/security/ip";

export const dynamic = "force-dynamic";

// POST /api/v1/mobile/auth/login — staff login, returns access + refresh tokens.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = mobileLoginSchema.safeParse(body);
  if (!parsed.success) return mobileResponse(apiError(400, "invalid_request", "Invalid login payload"));

  const { email, password, platform, deviceName, pushToken, twoFactorCode } = parsed.data;
  const res = await loginMobile(
    email,
    password,
    { platform, deviceName, pushToken },
    { ip: getClientIp(request.headers), userAgent: request.headers.get("user-agent"), twoFactorCode }
  );
  if (!res.ok) {
    const body = res.twoFactorRequired
      ? apiError(401, "two_factor_required", res.error)
      : apiError(401, "unauthorized", res.error);
    return mobileResponse(body);
  }
  return mobileResponse(ok(res.session));
}
