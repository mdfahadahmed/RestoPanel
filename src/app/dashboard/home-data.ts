import { prisma } from "@/lib/prisma";

/**
 * All data for the dashboard overview, fetched in parallel and tenant-scoped.
 * Returns plain serialisable values (Decimals → numbers, Dates → ISO) ready for
 * rendering. One round of `Promise.all` keeps the page fast.
 */

export interface DashboardHome {
  currency: string;
  today: { orders: number; revenue: number; pending: number; newCustomers: number };
  revenue7d: { day: string; label: string; revenue: number }[];
  lowStock: { id: string; name: string; stockQuantity: number | null; status: string }[];
  topSelling: { name: string; qty: number; revenue: number }[];
  activity: { id: string; status: string; orderNumber: string; createdAt: string }[];
}

export async function getDashboardHome(restaurantId: string): Promise<DashboardHome | null> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const start7 = new Date(startToday);
  start7.setDate(start7.getDate() - 6);
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 30);

  try {
    const [restaurant, ordersToday, revenueToday, pending, newCustomers, paid7d, lowStock, topRows, events] =
      await Promise.all([
        prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } }),
        prisma.order.count({ where: { restaurantId, createdAt: { gte: startToday } } }),
        prisma.order.aggregate({
          where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: startToday } },
          _sum: { total: true },
        }),
        prisma.order.count({ where: { restaurantId, status: "PENDING" } }),
        prisma.customer.count({ where: { restaurantId, createdAt: { gte: startToday } } }),
        prisma.order.findMany({
          where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: start7 } },
          select: { total: true, createdAt: true },
        }),
        prisma.product.findMany({
          where: { restaurantId, deletedAt: null, status: "ACTIVE", stockStatus: { in: ["LOW_STOCK", "OUT_OF_STOCK"] } },
          orderBy: { stockQuantity: "asc" },
          take: 6,
          select: { id: true, name: true, stockQuantity: true, stockStatus: true },
        }),
        prisma.orderItem.groupBy({
          by: ["nameSnapshot"],
          where: { order: { restaurantId, createdAt: { gte: start30 } } },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 6,
        }),
        prisma.orderEvent.findMany({
          where: { order: { restaurantId } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
        }),
      ]);

    // Build the 7 day-buckets (oldest → newest) so the chart always has 7 bars.
    const buckets: { day: string; label: string; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start7);
      d.setDate(start7.getDate() + i);
      buckets.push({
        day: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-GB", { weekday: "short" }),
        revenue: 0,
      });
    }
    const byDay = new Map(buckets.map((b) => [b.day, b]));
    for (const o of paid7d) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.revenue += Number(o.total);
    }

    return {
      currency: restaurant?.currency ?? "GBP",
      today: {
        orders: ordersToday,
        revenue: Number(revenueToday._sum.total ?? 0),
        pending,
        newCustomers,
      },
      revenue7d: buckets,
      lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stockQuantity: p.stockQuantity, status: p.stockStatus })),
      topSelling: topRows.map((r) => ({
        name: r.nameSnapshot,
        qty: r._sum.quantity ?? 0,
        revenue: Number(r._sum.lineTotal ?? 0),
      })),
      activity: events.map((e) => ({
        id: e.id,
        status: e.status,
        orderNumber: e.order.orderNumber,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}
