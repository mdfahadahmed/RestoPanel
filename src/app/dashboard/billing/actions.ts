"use server";

import { revalidatePath } from "next/cache";
import type { BillingCycle } from "@prisma/client";
import { requireTenant } from "@/lib/tenant";
import { getPlanBySlug } from "@/lib/billing/plans";
import {
  getSubscription,
  startTrial,
  changePlan,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/billing/subscription";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

/**
 * Tenant-facing billing actions for the manual flow (Stripe disabled, or Free
 * plans with no Stripe price). When Stripe is enabled for paid plans the client
 * instead posts to /api/billing/checkout. Either way these stay tenant-scoped.
 */

export async function changePlanAction(
  planSlug: string,
  cycle: BillingCycle
): Promise<ActionResult<{ kind: string; appliedNow: boolean }>> {
  const { restaurantId } = await requireTenant();
  const plan = await getPlanBySlug(planSlug);
  if (!plan || !plan.isActive) return actionError("That plan is not available.");

  const current = await getSubscription(restaurantId);

  // No subscription, or canceled/expired → start fresh (trial for paid plans).
  if (!current || current.status === "CANCELED" || current.status === "EXPIRED") {
    if (Number(plan.priceMonthly) > 0 || Number(plan.priceYearly) > 0) {
      await startTrial(restaurantId, plan);
      revalidatePath("/dashboard/billing");
      return actionOk({ kind: "trial", appliedNow: true });
    }
    await changePlan({ restaurantId, targetPlan: plan, cycle });
    revalidatePath("/dashboard/billing");
    return actionOk({ kind: "upgrade", appliedNow: true });
  }

  if (current.plan.id === plan.id && current.billingCycle === cycle) {
    return actionError("You are already on this plan.");
  }

  const result = await changePlan({ restaurantId, targetPlan: plan, cycle });
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return actionOk({ kind: result.kind, appliedNow: result.appliedNow });
}

export async function startTrialAction(planSlug: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const plan = await getPlanBySlug(planSlug);
  if (!plan || !plan.isActive) return actionError("That plan is not available.");

  const current = await getSubscription(restaurantId);
  if (current && current.status === "TRIALING") {
    return actionError("You are already on a trial.");
  }
  await startTrial(restaurantId, plan);
  revalidatePath("/dashboard/billing");
  return actionOk();
}

export async function cancelSubscriptionAction(
  immediately: boolean
): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const current = await getSubscription(restaurantId);
  if (!current) return actionError("No active subscription.");
  if (current.status === "CANCELED") return actionError("Subscription is already canceled.");

  await cancelSubscription({ restaurantId, immediately });
  revalidatePath("/dashboard/billing");
  return actionOk();
}

export async function resumeSubscriptionAction(): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const current = await getSubscription(restaurantId);
  if (!current) return actionError("No subscription to resume.");

  await resumeSubscription({ restaurantId });
  revalidatePath("/dashboard/billing");
  return actionOk();
}
