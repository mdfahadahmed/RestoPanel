import { handleApi } from "@/lib/api/handle";
import { listCategories } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, (ctx) => listCategories(ctx), { scope: "categories:read" });
}
