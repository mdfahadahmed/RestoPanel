import { authenticateMobile, type MobileContext } from "@/lib/mobile/auth";
import { can, type Permission } from "@/lib/staff/permissions";
import { apiError, type ApiResponse, API_VERSION } from "@/lib/api/respond";
import { captureError } from "@/lib/monitoring";

/**
 * Gateway for authenticated mobile endpoints: verify the access token → optional
 * permission (RBAC) check → handler. Mirrors `lib/api/handle.ts` but uses the
 * mobile bearer token instead of an API key. Always returns JSON with the API
 * version header.
 */

function toResponse(res: ApiResponse): Response {
  return Response.json(res.body, {
    status: res.status,
    headers: { "X-API-Version": API_VERSION, ...res.headers },
  });
}

export type MobileHandler = (ctx: MobileContext, request: Request) => Promise<ApiResponse> | ApiResponse;

export async function handleMobileApi(
  request: Request,
  handler: MobileHandler,
  opts: { permission?: Permission } = {}
): Promise<Response> {
  const ctx = await authenticateMobile(request.headers);
  if (!ctx) {
    return toResponse({
      ...apiError(401, "unauthorized", "Missing or invalid access token"),
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  if (opts.permission && !can(ctx.role, opts.permission)) {
    return toResponse(apiError(403, "forbidden", `Your role is missing the required permission: ${opts.permission}`));
  }

  try {
    return toResponse(await handler(ctx, request));
  } catch (e) {
    await captureError(e, { surface: "mobile-api", restaurantId: ctx.restaurantId, userId: ctx.userId });
    return toResponse(apiError(500, "internal_error", "Something went wrong"));
  }
}

/** Wrap an unauthenticated mobile endpoint (login/refresh/logout) into a Response. */
export function mobileResponse(res: ApiResponse): Response {
  return toResponse(res);
}
