import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Platform user directory: tenant users (owners/staff) across all restaurants. */

export async function listPlatformUsers(filters: {
  search?: string;
  role?: "ALL" | "OWNER" | "MANAGER" | "STAFF";
  page?: number;
  perPage?: number;
} = {}) {
  const { search, role = "ALL", page = 1, perPage = 25 } = filters;
  const where: Prisma.UserWhereInput = {};
  if (role !== "ALL") where.role = role;
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
  ]);
  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Platform operators (admin panel staff). */
export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}
