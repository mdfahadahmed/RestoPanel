import { handleApi, listQueryFromRequest } from "@/lib/api/handle";
import { listProducts } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, (ctx, req) => listProducts(ctx, listQueryFromRequest(req)), {
    scope: "products:read",
  });
}
