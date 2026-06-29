import { handleApi } from "@/lib/api/handle";
import { apiIndex } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(request, () => apiIndex());
}
