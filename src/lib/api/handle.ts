import { parseApiKey, authenticateApiKey } from "./keys";
import { checkRateLimit, rateLimitHeaders } from "./ratelimit";
import { hasScope, type ApiScope } from "./scopes";
import { apiError, type ApiResponse, API_VERSION } from "./respond";
import type { ApiContext } from "./endpoints";
import { captureError } from "@/lib/monitoring";
import { getClientIp, ipAllowed } from "@/lib/security/ip";

/**
 * The single gateway every /api/v1 route handler runs through:
 *   authenticate (API key) → rate limit → scope check → handler.
 * Always returns JSON with the API version + rate-limit headers attached.
 */

function toResponse(res: ApiResponse, extraHeaders?: Record<string, string>): Response {
  return Response.json(res.body, {
    status: res.status,
    headers: {
      "X-API-Version": API_VERSION,
      ...extraHeaders,
      ...res.headers,
    },
  });
}

export type ApiHandler = (ctx: ApiContext, request: Request) => Promise<ApiResponse> | ApiResponse;

export async function handleApi(
  request: Request,
  handler: ApiHandler,
  opts: { scope?: ApiScope } = {}
): Promise<Response> {
  const auth = await authenticateApiKey(parseApiKey(request.headers));
  if (!auth) {
    return toResponse(apiError(401, "unauthorized", "Missing or invalid API key"), {
      "WWW-Authenticate": "Bearer",
    });
  }

  // IP allowlist (when configured on the key) — fail closed on unknown IPs.
  if (auth.apiKey.ipAllowlist.length > 0 && !ipAllowed(getClientIp(request.headers), auth.apiKey.ipAllowlist)) {
    return toResponse(apiError(403, "ip_not_allowed", "This API key is not permitted from your IP address"));
  }

  const rl = await checkRateLimit(auth.apiKey.id, auth.apiKey.rateLimitPerMin);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return toResponse(apiError(429, "rate_limited", "Rate limit exceeded. Slow down."), {
      ...rlHeaders,
      "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
    });
  }

  if (opts.scope && !hasScope(auth.scopes, opts.scope)) {
    return toResponse(
      apiError(403, "forbidden", `This API key is missing the required scope: ${opts.scope}`),
      rlHeaders
    );
  }

  const ctx: ApiContext = { restaurantId: auth.restaurantId, scopes: auth.scopes };
  try {
    const res = await handler(ctx, request);
    return toResponse(res, rlHeaders);
  } catch (e) {
    await captureError(e, { surface: "public-api", restaurantId: auth.restaurantId });
    return toResponse(apiError(500, "internal_error", "Something went wrong"), rlHeaders);
  }
}

/** Parse common list query params from a request URL. */
export function listQueryFromRequest(request: Request) {
  const sp = new URL(request.url).searchParams;
  const numberOr = (v: string | null, fallback?: number) =>
    v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : fallback;
  return {
    page: numberOr(sp.get("page"), 1),
    perPage: numberOr(sp.get("perPage") ?? sp.get("per_page"), 20),
    search: sp.get("search") ?? sp.get("q") ?? undefined,
    categoryId: sp.get("categoryId") ?? sp.get("category") ?? undefined,
    status: sp.get("status") ?? undefined,
    available:
      sp.get("available") == null ? undefined : sp.get("available") === "true",
  };
}
