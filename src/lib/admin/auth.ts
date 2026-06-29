import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser, AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  signAdminToken,
  verifyAdminToken,
  type AdminTokenPayload,
} from "./session";

/** Read + verify the admin token from the cookie. No DB hit. */
export async function getAdminToken(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Resolve the signed-in admin for a server component / action. Verifies the
 * session cookie AND re-checks the AdminUser still exists and is active, then
 * optionally enforces a minimum set of roles. Redirects to /admin/login on any
 * failure — a tenant owner's session can never satisfy this.
 */
export async function requireAdmin(
  allowedRoles?: AdminRole[]
): Promise<AdminUser> {
  const token = await getAdminToken();
  if (!token) redirect("/admin/login");

  const admin = await prisma.adminUser.findUnique({ where: { id: token.sub } });
  if (!admin || !admin.isActive) redirect("/admin/login");

  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    // Authenticated but not authorised for this area.
    redirect("/admin?denied=1");
  }
  return admin;
}

/** Convenience guard for SUPER_ADMIN-only actions. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  return requireAdmin(["SUPER_ADMIN"]);
}

/** Sign a token for `admin` and write the httpOnly session cookie. */
export async function createAdminSession(admin: AdminUser): Promise<void> {
  const token = await signAdminToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
  });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

/** Clear the admin session cookie. */
export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
