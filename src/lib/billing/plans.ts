import type { Plan, BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Plan catalogue helpers. The canonical plan rows live in the database (seeded
 * via scripts/seed-admin.ts) so admins can edit pricing/limits without a deploy.
 * This module adds the typed capability/limit view and tier comparison used by
 * the billing engine.
 */

export const PLAN_SLUGS = ["free", "starter", "pro", "enterprise"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

/** Machine-readable feature flags a plan unlocks. */
export type Feature =
  | "analytics"
  | "smsNotifications"
  | "coupons"
  | "customDomain"
  | "prioritySupport";

export const FEATURES: Feature[] = [
  "analytics",
  "smsNotifications",
  "coupons",
  "customDomain",
  "prioritySupport",
];

export interface PlanLimits {
  maxProducts: number | null; // null = unlimited
  maxOrders: number | null; // per calendar month
  maxStaff: number | null;
}

export function planLimits(plan: Plan): PlanLimits {
  return {
    maxProducts: plan.maxProducts,
    maxOrders: plan.maxOrders,
    maxStaff: plan.maxStaff,
  };
}

export function planHasFeature(plan: Plan, feature: Feature): boolean {
  return Boolean(plan[feature]);
}

/** Per-cycle price as a number (Decimal → number at the edge). */
export function planPrice(plan: Plan, cycle: BillingCycle): number {
  return Number(cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly);
}

export function isPaidPlan(plan: Plan): boolean {
  return Number(plan.priceMonthly) > 0 || Number(plan.priceYearly) > 0;
}

/**
 * Compare two plans by tier rank (lower `position` = lower tier).
 * Returns > 0 if `target` is an upgrade over `current`, < 0 if a downgrade, 0 if same.
 */
export function comparePlans(current: Plan, target: Plan): number {
  return target.position - current.position;
}

export type ChangeKind = "upgrade" | "downgrade" | "same";

export function changeKind(current: Plan, target: Plan): ChangeKind {
  const c = comparePlans(current, target);
  return c > 0 ? "upgrade" : c < 0 ? "downgrade" : "same";
}

// --- DB reads --------------------------------------------------------------
export async function listActivePlans(): Promise<Plan[]> {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
  });
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  return prisma.plan.findUnique({ where: { slug } });
}

export async function getFreePlan(): Promise<Plan | null> {
  // Prefer the explicit "free" slug, else the lowest-tier zero-price plan.
  const free = await prisma.plan.findUnique({ where: { slug: "free" } });
  if (free) return free;
  return prisma.plan.findFirst({
    where: { isActive: true, priceMonthly: 0 },
    orderBy: { position: "asc" },
  });
}
