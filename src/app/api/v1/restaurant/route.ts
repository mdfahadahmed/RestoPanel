import { handleApi } from "@/lib/api/handle";
import { getRestaurant } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, (ctx) => getRestaurant(ctx), { scope: "restaurant:read" });
}
