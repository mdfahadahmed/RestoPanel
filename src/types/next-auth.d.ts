import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Extend the Auth.js session/user/JWT with tenant context so every request can
// scope data access to the authenticated restaurant.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      restaurantId: string;
      restaurantSlug: string;
      restaurantName: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    restaurantId: string;
    restaurantSlug: string;
    restaurantName: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    restaurantId: string;
    restaurantSlug: string;
    restaurantName: string;
    role: Role;
  }
}
