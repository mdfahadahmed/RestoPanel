import { prisma } from "@/lib/prisma";

export interface CustomerStats {
  total: number;
  newThisMonth: number;
  active: number;
  inactive: number;
  blocked: number;
  growthPct: number; // new this month vs previous month
  avgOrderValue: number;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Tenant-scoped aggregate metrics for the customers dashboard. */
export async function getCustomerStats(restaurantId: string): Promise<CustomerStats> {
  const now = new Date();
  const thisMonth = startOfMonth(now);
  const prevMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);

  const [total, byStatus, newThisMonth, newPrevMonth, revenueAgg] = await Promise.all([
    prisma.customer.count({ where: { restaurantId } }),
    prisma.customer.groupBy({ by: ["status"], where: { restaurantId }, _count: { _all: true } }),
    prisma.customer.count({ where: { restaurantId, createdAt: { gte: thisMonth } } }),
    prisma.customer.count({ where: { restaurantId, createdAt: { gte: prevMonth, lt: thisMonth } } }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (s: string) => byStatus.find((g) => g.status === s)?._count._all ?? 0;

  const growthPct =
    newPrevMonth === 0 ? (newThisMonth > 0 ? 100 : 0) : ((newThisMonth - newPrevMonth) / newPrevMonth) * 100;

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const paidCount = revenueAgg._count._all;
  const avgOrderValue = paidCount > 0 ? revenue / paidCount : 0;

  return {
    total,
    newThisMonth,
    active: statusCount("ACTIVE"),
    inactive: statusCount("INACTIVE"),
    blocked: statusCount("BLOCKED"),
    growthPct,
    avgOrderValue,
  };
}

/**
 * Resolve the customerIds that satisfy aggregate thresholds (min total orders
 * and/or min total paid spending), tenant-scoped. Returns `null` when no
 * aggregate filter is active (caller should then skip id-filtering).
 */
export async function customerIdsForAggregates(
  restaurantId: string,
  minOrders: number,
  minSpending: number
): Promise<string[] | null> {
  if (minOrders <= 0 && minSpending <= 0) return null;

  let ids: Set<string> | null = null;

  if (minOrders > 0) {
    const grouped = await prisma.order.groupBy({
      by: ["customerId"],
      where: { restaurantId, customerId: { not: null } },
      _count: { _all: true },
      having: { id: { _count: { gte: minOrders } } },
    });
    ids = new Set(grouped.map((g) => g.customerId!).filter(Boolean));
  }

  if (minSpending > 0) {
    const grouped = await prisma.order.groupBy({
      by: ["customerId"],
      where: { restaurantId, customerId: { not: null }, paymentStatus: "PAID" },
      _sum: { total: true },
    });
    const spendIds = new Set(
      grouped.filter((g) => Number(g._sum.total ?? 0) >= minSpending).map((g) => g.customerId!).filter(Boolean)
    );
    ids = ids ? new Set([...ids].filter((id) => spendIds.has(id))) : spendIds;
  }

  return [...(ids ?? new Set<string>())];
}
