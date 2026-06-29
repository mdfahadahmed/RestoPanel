import { handleApi, listQueryFromRequest } from "@/lib/api/handle";
import { listCustomers } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, (ctx, req) => listCustomers(ctx, listQueryFromRequest(req)), {
    scope: "customers:read",
  });
}
