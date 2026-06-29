import { handleApi, listQueryFromRequest } from "@/lib/api/handle";
import { apiError } from "@/lib/api/respond";
import { listOrders, createOrder } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, (ctx, req) => listOrders(ctx, listQueryFromRequest(req)), {
    scope: "orders:read",
  });
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (ctx, req) => {
      const body = await req.json().catch(() => null);
      if (body == null) return apiError(400, "invalid_json", "Request body must be valid JSON");
      return createOrder(ctx, body);
    },
    { scope: "orders:write" }
  );
}
