"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

/**
 * Server actions backing the dashboard header: global search across the tenant's
 * orders / products / customers, and the notifications center. Both are strictly
 * scoped to the signed-in restaurant.
 */

export interface SearchResults {
  orders: { id: string; orderNumber: string; label: string; status: string }[];
  products: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string }[];
}

export async function globalSearch(query: unknown): Promise<SearchResults> {
  const { restaurantId } = await requireTenant();
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < 1) return { orders: [], products: [], customers: [] };

  const [orders, products, customers] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId,
        OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, status: true },
    }),
    prisma.product.findMany({
      where: { restaurantId, deletedAt: null, name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: {
        restaurantId,
        OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, phone: true },
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      label: o.customerName ?? "Walk-in",
      status: o.status,
    })),
    products: products.map((p) => ({ id: p.id, name: p.name })),
    customers: customers.map((c) => ({ id: c.id, name: c.name ?? "Unnamed", phone: c.phone })),
  };
}

export interface NotificationFeed {
  pendingOrders: number;
  items: { id: string; event: string; channel: string; status: string; recipient: string; createdAt: string }[];
}

export async function getNotifications(): Promise<NotificationFeed> {
  const { restaurantId } = await requireTenant();
  const [pendingOrders, logs] = await Promise.all([
    prisma.order.count({ where: { restaurantId, status: "PENDING" } }),
    prisma.notificationLog.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, event: true, channel: true, status: true, recipient: true, createdAt: true },
    }),
  ]);

  return {
    pendingOrders,
    items: logs.map((l) => ({
      id: l.id,
      event: l.event,
      channel: l.channel,
      status: l.status,
      recipient: l.recipient,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}
