import { prisma } from "@/lib/prisma";

/**
 * Platform-wide metrics for the Super Admin dashboard & analytics.
 *
 * Everything here is a pure data function (no auth, no request context) so it
 * can be unit-tested directly. Money is normalised to numbers at the edge —
 * invoice/subscription amounts are stored as Prisma Decimal.
 */

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface PlatformOverview {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  pendingRestaurants: number;
  totalUsers: number;
  monthlyRevenue: number; // PAID invoices in the current calendar month
  totalRevenue: number; // all-time PAID invoices
  mrr: number;
  arr: number;
  newSignups: number; // restaurants created in the last 30 days
  trialUsers: number; // subscriptions currently TRIALING
  activeSubscriptions: number;
  expiringSubscriptions: number; // period ends within 7 days
  openTickets: number;
  churnRate: number; // % canceled in last 30d vs (active + canceled)
}

const DAY = 86_400_000;

/** Normalise a per-cycle amount to a monthly figure. */
function toMonthly(amount: number, cycle: "MONTHLY" | "YEARLY"): number {
  return cycle === "YEARLY" ? amount / 12 : amount;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getPlatformOverview(
  now: Date = new Date()
): Promise<PlatformOverview> {
  const monthStart = startOfMonth(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
  const sevenDaysAhead = new Date(now.getTime() + 7 * DAY);

  const notDeleted = { platformDeletedAt: null };

  const [
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants,
    pendingRestaurants,
    totalUsers,
    newSignups,
    activeSubs,
    trialSubs,
    expiringSubs,
    openTickets,
    canceledLast30,
    monthInvoices,
    paidAgg,
  ] = await Promise.all([
    prisma.restaurant.count({ where: notDeleted }),
    prisma.restaurant.count({ where: { ...notDeleted, status: "ACTIVE" } }),
    prisma.restaurant.count({ where: { ...notDeleted, status: "SUSPENDED" } }),
    prisma.restaurant.count({ where: { ...notDeleted, status: "PENDING" } }),
    prisma.user.count(),
    prisma.restaurant.count({
      where: { ...notDeleted, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { amount: true, billingCycle: true },
    }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.subscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        currentPeriodEnd: { gte: now, lte: sevenDaysAhead },
      },
    }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.subscription.count({
      where: { status: "CANCELED", canceledAt: { gte: thirtyDaysAgo } },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", paidAt: { gte: monthStart } },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: "PAID" },
    }),
  ]);

  const mrr = activeSubs.reduce(
    (sum, s) => sum + toMonthly(Number(s.amount), s.billingCycle),
    0
  );
  const activeSubscriptions = activeSubs.length;
  const churnDenom = activeSubscriptions + canceledLast30;

  return {
    totalRestaurants,
    activeRestaurants,
    suspendedRestaurants,
    pendingRestaurants,
    totalUsers,
    monthlyRevenue: Number(monthInvoices._sum.amount ?? 0),
    totalRevenue: Number(paidAgg._sum.amount ?? 0),
    mrr: round2(mrr),
    arr: round2(mrr * 12),
    newSignups,
    trialUsers: trialSubs,
    activeSubscriptions,
    expiringSubscriptions: expiringSubs,
    openTickets,
    churnRate: churnDenom === 0 ? 0 : round2((canceledLast30 / churnDenom) * 100),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build N monthly buckets ending in the month of `now` (oldest first). */
function monthlyBuckets(now: Date, count: number) {
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: start.toLocaleString("en-GB", { month: "short" }),
      start,
      end,
    });
  }
  return buckets;
}

export interface PlatformSeries {
  revenue: SeriesPoint[];
  restaurantGrowth: SeriesPoint[];
  userGrowth: SeriesPoint[];
}

/** Monthly time series (default last 12 months) for the dashboard charts. */
export async function getPlatformSeries(
  now: Date = new Date(),
  months = 12
): Promise<PlatformSeries> {
  const buckets = monthlyBuckets(now, months);
  const windowStart = buckets[0].start;

  const [invoices, restaurants, users] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: windowStart } },
      select: { amount: true, paidAt: true },
    }),
    prisma.restaurant.findMany({
      where: { platformDeletedAt: null, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
  ]);

  const bucketIndex = (d: Date) =>
    buckets.findIndex((b) => d >= b.start && d < b.end);

  const revenue = buckets.map((b) => ({ label: b.label, value: 0 }));
  const restaurantGrowth = buckets.map((b) => ({ label: b.label, value: 0 }));
  const userGrowth = buckets.map((b) => ({ label: b.label, value: 0 }));

  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const i = bucketIndex(inv.paidAt);
    if (i >= 0) revenue[i].value += Number(inv.amount);
  }
  for (const r of restaurants) {
    const i = bucketIndex(r.createdAt);
    if (i >= 0) restaurantGrowth[i].value += 1;
  }
  for (const u of users) {
    const i = bucketIndex(u.createdAt);
    if (i >= 0) userGrowth[i].value += 1;
  }

  for (const p of revenue) p.value = round2(p.value);

  return { revenue, restaurantGrowth, userGrowth };
}

export interface ChurnBreakdown {
  activeSubscriptions: number;
  canceledLast30: number;
  churnRate: number;
  newSubsLast30: number;
}

export async function getChurnBreakdown(
  now: Date = new Date()
): Promise<ChurnBreakdown> {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
  const [active, canceled, created] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({
      where: { status: "CANCELED", canceledAt: { gte: thirtyDaysAgo } },
    }),
    prisma.subscription.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);
  const denom = active + canceled;
  return {
    activeSubscriptions: active,
    canceledLast30: canceled,
    newSubsLast30: created,
    churnRate: denom === 0 ? 0 : round2((canceled / denom) * 100),
  };
}
