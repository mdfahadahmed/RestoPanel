import { prisma } from "@/lib/prisma";

export interface SeriesPoint {
  label: string;
  revenue: number;
  orders?: number;
}

export interface AnalyticsData {
  revenue: number;
  orders: number;
  newCustomers: number;
  avgOrderValue: number;
  returningCustomers: number;
  daily: SeriesPoint[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
  ordersTrend: { label: string; orders: number }[];
  bestSellers: { name: string; quantity: number; revenue: number }[];
  categorySales: { name: string; revenue: number }[];
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dayKey(d: Date) {
  return startOfDay(d).getTime();
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -day);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** All analytics for a tenant within [from, to]; weekly/monthly use a 6-month window. */
export async function getAnalytics(restaurantId: string, from: Date, to: Date): Promise<AnalyticsData> {
  const now = new Date();
  const sixMonthsAgo = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));

  const [rangeOrders, newCustomers, trendOrders, bestSellersRaw, categoryByProduct] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: from, lte: to } },
      select: { total: true, createdAt: true, paymentStatus: true, customerId: true },
    }),
    prisma.customer.count({ where: { restaurantId, createdAt: { gte: from, lte: to } } }),
    prisma.order.findMany({
      where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: sixMonthsAgo } },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ["nameSnapshot"],
      where: { order: { restaurantId, createdAt: { gte: from, lte: to } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { restaurantId, createdAt: { gte: from, lte: to } }, productId: { not: null } },
      _sum: { lineTotal: true },
    }),
  ]);

  // --- Cards ---
  const paid = rangeOrders.filter((o) => o.paymentStatus === "PAID");
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const orders = rangeOrders.length;
  const avgOrderValue = paid.length > 0 ? revenue / paid.length : 0;

  const ordersByCustomer = new Map<string, number>();
  for (const o of rangeOrders) {
    if (o.customerId) ordersByCustomer.set(o.customerId, (ordersByCustomer.get(o.customerId) ?? 0) + 1);
  }
  const returningCustomers = [...ordersByCustomer.values()].filter((n) => n >= 2).length;

  // --- Daily (within range, capped at 90 days) ---
  const totalDays = Math.min(90, Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1));
  const dayStart = addDays(startOfDay(to), -(totalDays - 1));
  const dailyMap = new Map<number, { revenue: number; orders: number }>();
  for (let i = 0; i < totalDays; i++) {
    dailyMap.set(dayKey(addDays(dayStart, i)), { revenue: 0, orders: 0 });
  }
  for (const o of rangeOrders) {
    const k = dayKey(o.createdAt);
    const bucket = dailyMap.get(k);
    if (bucket) {
      bucket.orders += 1;
      if (o.paymentStatus === "PAID") bucket.revenue += Number(o.total);
    }
  }
  const daily: SeriesPoint[] = [];
  const ordersTrend: { label: string; orders: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(dayStart, i);
    const b = dailyMap.get(dayKey(d))!;
    const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    daily.push({ label, revenue: Math.round(b.revenue * 100) / 100 });
    ordersTrend.push({ label, orders: b.orders });
  }

  // --- Weekly (last 8 weeks) + Monthly (last 6 months) from trendOrders ---
  const weekMap = new Map<number, number>();
  const thisWeek = startOfWeek(now);
  for (let i = 7; i >= 0; i--) weekMap.set(addDays(thisWeek, -i * 7).getTime(), 0);
  const monthMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthMap.set(`${m.getFullYear()}-${m.getMonth()}`, 0);
  }
  for (const o of trendOrders) {
    const wk = startOfWeek(o.createdAt).getTime();
    if (weekMap.has(wk)) weekMap.set(wk, weekMap.get(wk)! + Number(o.total));
    const mk = `${o.createdAt.getFullYear()}-${o.createdAt.getMonth()}`;
    if (monthMap.has(mk)) monthMap.set(mk, monthMap.get(mk)! + Number(o.total));
  }
  const weekly: SeriesPoint[] = [...weekMap.entries()].map(([ts, rev]) => ({
    label: new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    revenue: Math.round(rev * 100) / 100,
  }));
  const monthly: SeriesPoint[] = [...monthMap.entries()].map(([key, rev]) => {
    const [y, m] = key.split("-").map(Number);
    return {
      label: new Date(y, m, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      revenue: Math.round(rev * 100) / 100,
    };
  });

  // --- Best sellers ---
  const bestSellers = bestSellersRaw.map((b) => ({
    name: b.nameSnapshot,
    quantity: b._sum.quantity ?? 0,
    revenue: Math.round(Number(b._sum.lineTotal ?? 0) * 100) / 100,
  }));

  // --- Category sales ---
  const productIds = categoryByProduct.map((c) => c.productId!).filter(Boolean);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { restaurantId, id: { in: productIds } },
        select: { id: true, category: { select: { name: true } } },
      })
    : [];
  const catNameByProduct = new Map(products.map((p) => [p.id, p.category?.name ?? "Uncategorised"]));
  const catTotals = new Map<string, number>();
  for (const c of categoryByProduct) {
    const name = catNameByProduct.get(c.productId!) ?? "Uncategorised";
    catTotals.set(name, (catTotals.get(name) ?? 0) + Number(c._sum.lineTotal ?? 0));
  }
  const categorySales = [...catTotals.entries()]
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return {
    revenue: Math.round(revenue * 100) / 100,
    orders,
    newCustomers,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    returningCustomers,
    daily,
    weekly,
    monthly,
    ordersTrend,
    bestSellers,
    categorySales,
  };
}
