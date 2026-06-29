import type { Prisma, SubscriptionStatus, BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Plans + subscriptions data for the admin Subscriptions module. */

export async function listPlans() {
  return prisma.plan.findMany({
    orderBy: [{ position: "asc" }, { priceMonthly: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });
}

export async function listSubscriptions(filters: {
  status?: SubscriptionStatus | "ALL";
  page?: number;
  perPage?: number;
} = {}) {
  const { status = "ALL", page = 1, perPage = 20 } = filters;
  const where: Prisma.SubscriptionWhereInput = {};
  if (status !== "ALL") where.status = status;

  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { currentPeriodEnd: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        plan: { select: { name: true } },
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
  ]);
  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * Create or replace a restaurant's subscription on a plan. Snapshots the plan
 * price for the chosen cycle and sets a trial / period window.
 */
export async function upsertSubscription(input: {
  restaurantId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  now?: Date;
}) {
  const { restaurantId, planId, now = new Date() } = input;
  const billingCycle = input.billingCycle ?? "MONTHLY";
  const status = input.status ?? "TRIALING";

  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const amount = billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

  const periodEnd =
    billingCycle === "YEARLY"
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const trialEndsAt =
    status === "TRIALING"
      ? new Date(now.getTime() + plan.trialDays * 86_400_000)
      : null;

  const data = {
    planId,
    status,
    billingCycle,
    amount,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialEndsAt,
    canceledAt: status === "CANCELED" ? now : null,
  };

  return prisma.subscription.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
  });
}

export async function setSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
  now: Date = new Date()
) {
  return prisma.subscription.update({
    where: { id },
    data: { status, canceledAt: status === "CANCELED" ? now : null },
  });
}
