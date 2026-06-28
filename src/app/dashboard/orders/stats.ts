import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/validations/order";

export interface OrderStats {
  total: number;
  today: number;
  byStatus: Record<OrderStatus, number>;
  revenue: number;
  paidCount: number;
  avgOrderValue: number;
}

const ZERO_BY_STATUS: Record<OrderStatus, number> = {
  PENDING: 0,
  CONFIRMED: 0,
  PREPARING: 0,
  READY: 0,
  OUT_FOR_DELIVERY: 0,
  DELIVERED: 0,
  CANCELLED: 0,
  REJECTED: 0,
  REFUNDED: 0,
};

/** Tenant-scoped aggregate metrics for the orders dashboard. */
export async function getOrderStats(restaurantId: string): Promise<OrderStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [grouped, today, revenueAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: startOfToday } } }),
    // Revenue = value of paid orders.
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const byStatus = { ...ZERO_BY_STATUS };
  let total = 0;
  for (const g of grouped) {
    byStatus[g.status as OrderStatus] = g._count._all;
    total += g._count._all;
  }

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const paidCount = revenueAgg._count._all;
  const avgOrderValue = paidCount > 0 ? revenue / paidCount : 0;

  return { total, today, byStatus, revenue, paidCount, avgOrderValue };
}
