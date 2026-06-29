import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planHasFeature, type Feature } from "./plans";

/**
 * Usage limits & feature restrictions.
 *
 * Enforcement rule: a restaurant WITHOUT a subscription is unrestricted. Limits
 * and feature gates only apply once a tenant is on a plan (every new signup gets
 * a Free subscription). This keeps the platform open for legacy/seed data while
 * giving real tenants concrete entitlements.
 */

export type LimitKind = "products" | "orders" | "staff";

export interface UsageSnapshot {
  products: number;
  ordersThisMonth: number;
  staff: number;
}

export async function getUsage(
  restaurantId: string,
  now: Date = new Date()
): Promise<UsageSnapshot> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [products, ordersThisMonth, staff] = await Promise.all([
    prisma.product.count({ where: { restaurantId, deletedAt: null } }),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { restaurantId } }),
  ]);
  return { products, ordersThisMonth, staff };
}

async function getPlan(restaurantId: string): Promise<Plan | null> {
  const sub = await prisma.subscription.findUnique({
    where: { restaurantId },
    select: { status: true, plan: true },
  });
  if (!sub) return null;
  // A fully canceled/expired subscription no longer grants its plan features.
  if (sub.status === "CANCELED" || sub.status === "EXPIRED") return null;
  return sub.plan;
}

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited / not enforced
  remaining: number | null;
}

function limitForKind(plan: Plan, kind: LimitKind): number | null {
  switch (kind) {
    case "products":
      return plan.maxProducts;
    case "orders":
      return plan.maxOrders;
    case "staff":
      return plan.maxStaff;
  }
}

function usedForKind(usage: UsageSnapshot, kind: LimitKind): number {
  switch (kind) {
    case "products":
      return usage.products;
    case "orders":
      return usage.ordersThisMonth;
    case "staff":
      return usage.staff;
  }
}

/**
 * Check whether the restaurant is under its plan limit for `kind`.
 * `addition` is how many new items are about to be created (default 1).
 */
export async function checkLimit(
  restaurantId: string,
  kind: LimitKind,
  addition = 1,
  now: Date = new Date()
): Promise<LimitCheck> {
  const plan = await getPlan(restaurantId);
  const usage = await getUsage(restaurantId, now);
  const used = usedForKind(usage, kind);

  if (!plan) return { allowed: true, used, limit: null, remaining: null };
  const limit = limitForKind(plan, kind);
  if (limit == null) return { allowed: true, used, limit: null, remaining: null };

  const remaining = Math.max(0, limit - used);
  return { allowed: used + addition <= limit, used, limit, remaining };
}

/** Feature gate. Returns true when allowed (and when there is no plan to gate). */
export async function canUseFeature(
  restaurantId: string,
  feature: Feature
): Promise<boolean> {
  const plan = await getPlan(restaurantId);
  if (!plan) return true;
  return planHasFeature(plan, feature);
}

/** Full entitlement snapshot for the billing UI. */
export interface Entitlements {
  plan: Plan | null;
  usage: UsageSnapshot;
  limits: { products: LimitCheck; orders: LimitCheck; staff: LimitCheck };
  features: Record<Feature, boolean>;
}

export async function getEntitlements(
  restaurantId: string,
  now: Date = new Date()
): Promise<Entitlements> {
  const [plan, usage] = await Promise.all([
    getPlan(restaurantId),
    getUsage(restaurantId, now),
  ]);

  const mk = (kind: LimitKind): LimitCheck => {
    const used = usedForKind(usage, kind);
    const limit = plan ? limitForKind(plan, kind) : null;
    if (limit == null) return { allowed: true, used, limit: null, remaining: null };
    return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
  };

  const features = {
    analytics: plan ? plan.analytics : true,
    smsNotifications: plan ? plan.smsNotifications : true,
    coupons: plan ? plan.coupons : true,
    customDomain: plan ? plan.customDomain : true,
    prioritySupport: plan ? plan.prioritySupport : true,
  };

  return {
    plan,
    usage,
    limits: { products: mk("products"), orders: mk("orders"), staff: mk("staff") },
    features,
  };
}
