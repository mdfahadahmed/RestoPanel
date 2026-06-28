import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export interface TenantContext {
  userId: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  role: Role;
}

/**
 * Resolve the authenticated tenant context in a server component or route
 * handler. Redirects to /login when there is no session.
 *
 * Always derive `restaurantId` from this helper — never trust a client-supplied
 * restaurant id — so data access stays scoped to the signed-in restaurant.
 */
export async function requireTenant(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.restaurantId) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    restaurantId: session.user.restaurantId,
    restaurantSlug: session.user.restaurantSlug,
    restaurantName: session.user.restaurantName,
    role: session.user.role,
  };
}
