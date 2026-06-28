import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Run only the edge-safe config in middleware (no Prisma/bcrypt). The
// `authorized` callback in auth.config.ts decides access.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Skip Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
