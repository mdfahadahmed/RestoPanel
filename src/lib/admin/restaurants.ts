import type { Prisma, RestaurantStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Platform restaurant data + moderation. Pure functions (no auth/request) so
 * the admin server actions can wrap them with `requireAdmin()` and tests can
 * call them directly.
 */

export interface RestaurantListFilters {
  search?: string;
  status?: RestaurantStatus | "ALL";
  page?: number;
  perPage?: number;
}

export async function listRestaurants(filters: RestaurantListFilters = {}) {
  const { search, status = "ALL", page = 1, perPage = 20 } = filters;

  const where: Prisma.RestaurantWhereInput = { platformDeletedAt: null };
  if (status !== "ALL") where.status = status;
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { ownerName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        slug: true,
        ownerName: true,
        email: true,
        status: true,
        createdAt: true,
        suspendedAt: true,
        subscription: {
          select: {
            status: true,
            plan: { select: { name: true } },
            currentPeriodEnd: true,
          },
        },
        _count: { select: { orders: true, products: true, users: true } },
      },
    }),
  ]);

  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Full detail for a single restaurant (owner, subscription, usage, invoices). */
export async function getRestaurantDetail(id: string) {
  return prisma.restaurant.findFirst({
    where: { id, platformDeletedAt: null },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      subscription: { include: { plan: true } },
      invoices: { orderBy: { issuedAt: "desc" }, take: 10 },
      _count: {
        select: {
          orders: true,
          products: true,
          customers: true,
          categories: true,
          reviews: true,
        },
      },
    },
  });
}

export async function suspendRestaurant(id: string, reason?: string) {
  return prisma.restaurant.update({
    where: { id },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendedReason: reason?.trim() || null,
    },
  });
}

export async function activateRestaurant(id: string) {
  return prisma.restaurant.update({
    where: { id },
    data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
  });
}

/**
 * Soft-delete a restaurant from the platform: flag it and force-suspend so it
 * disappears from listings and can no longer operate, while data is retained
 * for audit. (A hard delete cascades — avoided by default.)
 */
export async function softDeleteRestaurant(id: string) {
  return prisma.restaurant.update({
    where: { id },
    data: {
      platformDeletedAt: new Date(),
      status: "SUSPENDED",
      suspendedAt: new Date(),
    },
  });
}

/** Permanently delete a restaurant and all tenant data (cascade). */
export async function hardDeleteRestaurant(id: string) {
  return prisma.restaurant.delete({ where: { id } });
}
