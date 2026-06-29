import { buildOpenApiSpec } from "@/lib/api/openapi";

// Public — the spec describes how to authenticate; it carries no secrets.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(buildOpenApiSpec(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
