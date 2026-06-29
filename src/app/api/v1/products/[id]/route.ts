import { handleApi } from "@/lib/api/handle";
import { getProduct } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleApi(request, (ctx) => getProduct(ctx, id), { scope: "products:read" });
}
