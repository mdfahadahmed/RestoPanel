import { handleMobileApi } from "@/lib/mobile/gateway";
import { ok, apiError } from "@/lib/api/respond";
import { prisma } from "@/lib/prisma";
import { can, PERMISSION_LABELS, type Permission } from "@/lib/staff/permissions";

export const dynamic = "force-dynamic";

// GET /api/v1/mobile/me — the signed-in staff member, their restaurant and the
// permissions their role grants (so the app can show/hide features).
export async function GET(request: Request) {
  return handleMobileApi(request, async (ctx) => {
    const [user, restaurant] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true, role: true, phone: true },
      }),
      prisma.restaurant.findUnique({
        where: { id: ctx.restaurantId },
        select: { id: true, name: true, slug: true, currency: true, currencySymbol: true, timezone: true },
      }),
    ]);
    if (!user || !restaurant) return apiError(404, "not_found", "Account not found");

    const permissions = (Object.keys(PERMISSION_LABELS) as Permission[]).filter((p) => can(ctx.role, p));
    return ok({ user, restaurant, permissions });
  });
}
