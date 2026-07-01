import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import { ADMIN_COOKIE, verifyAdminToken } from "./lib/admin/session";
import { CUSTOMER_COOKIE, verifyCustomerToken } from "./lib/account/session";

// Edge-safe Auth.js configuration. Intentionally contains NO database or
// bcrypt imports so it can run inside middleware. The Credentials provider
// (which needs Prisma + bcrypt) is added separately in `auth.ts`.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // populated in auth.ts
  callbacks: {
    // Gate the dashboard and the (separately authenticated) admin area; bounce
    // authenticated users away from the matching auth pages.
    async authorized({ auth, request: { nextUrl, cookies } }) {
      const { pathname } = nextUrl;

      // --- Super Admin area -------------------------------------------------
      // Gated EXCLUSIVELY by the standalone admin session cookie — a tenant
      // owner's NextAuth session is irrelevant here, so owners can never enter.
      if (pathname.startsWith("/admin")) {
        const adminToken = await verifyAdminToken(
          cookies.get(ADMIN_COOKIE)?.value
        );
        const isAdminLogin = pathname === "/admin/login";

        if (isAdminLogin) {
          if (adminToken) return Response.redirect(new URL("/admin", nextUrl));
          return true;
        }
        if (!adminToken) {
          const url = new URL("/admin/login", nextUrl);
          url.searchParams.set("next", pathname);
          return Response.redirect(url);
        }
        return true;
      }

      // --- Customer account panel -------------------------------------------
      // Gated EXCLUSIVELY by the standalone customer session cookie — separate
      // from both the tenant owner's NextAuth session and the admin session.
      if (pathname.startsWith("/account")) {
        const customerToken = await verifyCustomerToken(
          cookies.get(CUSTOMER_COOKIE)?.value
        );
        const isCustomerAuthPage =
          pathname === "/account/login" || pathname === "/account/register";

        if (isCustomerAuthPage) {
          if (customerToken) return Response.redirect(new URL("/account", nextUrl));
          return true;
        }
        if (!customerToken) {
          const url = new URL("/account/login", nextUrl);
          if (pathname !== "/account") url.searchParams.set("next", pathname);
          return Response.redirect(url);
        }
        return true;
      }

      // --- Tenant dashboard -------------------------------------------------
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = pathname.startsWith("/dashboard");
      const isOnAuthPage = pathname === "/login" || pathname === "/register";

      if (isOnDashboard) return isLoggedIn;
      if (isOnAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    // Persist tenant context onto the JWT at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.restaurantId = user.restaurantId;
        token.restaurantSlug = user.restaurantSlug;
        token.restaurantName = user.restaurantName;
        token.role = user.role;
        if (user.id) token.sub = user.id;
      }
      return token;
    },
    // Expose tenant context on the session for server components & route handlers.
    // Read token fields with casts: the JWT carries an index signature of
    // `unknown`, and the `next-auth/jwt` module augmentation does not reliably
    // merge into the JWT type these callbacks receive in Auth.js v5.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.restaurantId = token.restaurantId as string;
      session.user.restaurantSlug = token.restaurantSlug as string;
      session.user.restaurantName = token.restaurantName as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
