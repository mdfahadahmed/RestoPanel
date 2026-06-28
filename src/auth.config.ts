import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

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
    // Gate the dashboard; bounce authenticated users away from auth pages.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

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
