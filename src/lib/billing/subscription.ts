import type { BillingCycle, Plan, Subscription, SubscriptionStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { changeKind, isPaidPlan, planPrice, type ChangeKind } from "./plans";
import { recordInvoice } from "./invoices";

/**
 * Subscription lifecycle engine. Pure DB operations (no auth, no Stripe) so the
 * same functions back BOTH the manual flow (Stripe not configured) and the
 * Stripe-webhook sync, and can be tested directly.
 */

export type SubscriptionWithPlan = Subscription & { plan: Plan };

const DAY = 86_400_000;

/** Add one billing cycle to a date (month for MONTHLY, year for YEARLY). */
export function addCycle(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from);
  if (cycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getSubscription(
  restaurantId: string
): Promise<SubscriptionWithPlan | null> {
  return prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  });
}

/** Start a free trial of `plan` for a restaurant with no active subscription. */
export async function startTrial(
  restaurantId: string,
  plan: Plan,
  now: Date = new Date()
): Promise<SubscriptionWithPlan> {
  const trialEndsAt = new Date(now.getTime() + plan.trialDays * DAY);
  const data = {
    planId: plan.id,
    status: "TRIALING" as SubscriptionStatus,
    billingCycle: "MONTHLY" as BillingCycle,
    amount: new Prisma.Decimal(planPrice(plan, "MONTHLY")),
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    trialEndsAt,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    pendingPlanId: null,
    pendingBillingCycle: null,
  };
  return prisma.subscription.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
    include: { plan: true },
  });
}

/**
 * Put a restaurant directly onto `plan` as an ACTIVE (or trialing) subscription.
 * Used for initial Free signup and after a successful first payment. Generates
 * an invoice when the plan is paid and `status` is ACTIVE.
 */
export async function subscribeToPlan(input: {
  restaurantId: string;
  plan: Plan;
  cycle?: BillingCycle;
  status?: SubscriptionStatus;
  now?: Date;
  withInvoice?: boolean;
}): Promise<SubscriptionWithPlan> {
  const { restaurantId, plan } = input;
  const cycle = input.cycle ?? "MONTHLY";
  const now = input.now ?? new Date();
  const status = input.status ?? "ACTIVE";
  const amount = planPrice(plan, cycle);

  const periodEnd = addCycle(now, cycle);
  const data = {
    planId: plan.id,
    status,
    billingCycle: cycle,
    amount: new Prisma.Decimal(amount),
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialEndsAt: status === "TRIALING" ? new Date(now.getTime() + plan.trialDays * DAY) : null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    pendingPlanId: null,
    pendingBillingCycle: null,
  };

  const sub = await prisma.subscription.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
    include: { plan: true },
  });

  if (input.withInvoice && status === "ACTIVE" && isPaidPlan(plan) && amount > 0) {
    await recordInvoice({
      restaurantId,
      subscriptionId: sub.id,
      amount,
      currency: plan.currency,
      status: "PAID",
      description: `${plan.name} — ${cycle.toLowerCase()}`,
      periodStart: now,
      periodEnd,
      paidAt: now,
      issuedAt: now,
    });
  }
  return sub;
}

export interface ChangePlanResult {
  kind: ChangeKind;
  subscription: SubscriptionWithPlan;
  /** True when the change takes effect immediately (upgrade); false when scheduled (downgrade). */
  appliedNow: boolean;
}

/**
 * Upgrade or downgrade.
 *  - Upgrade: applied immediately, new period starts now, an invoice is raised
 *    for the (prorated, here full-cycle) amount of a paid plan.
 *  - Downgrade: scheduled — the new plan takes effect at period end so the
 *    tenant keeps what they paid for. Stored on pendingPlanId/pendingBillingCycle.
 */
export async function changePlan(input: {
  restaurantId: string;
  targetPlan: Plan;
  cycle?: BillingCycle;
  now?: Date;
}): Promise<ChangePlanResult> {
  const { restaurantId, targetPlan } = input;
  const now = input.now ?? new Date();
  const cycle = input.cycle ?? "MONTHLY";

  const current = await prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  });
  if (!current) {
    // No subscription yet → treat as a fresh subscribe.
    const sub = await subscribeToPlan({ restaurantId, plan: targetPlan, cycle, now, withInvoice: true });
    return { kind: "upgrade", subscription: sub, appliedNow: true };
  }

  const kind = changeKind(current.plan, targetPlan);

  if (kind === "downgrade") {
    const subscription = await prisma.subscription.update({
      where: { restaurantId },
      data: { pendingPlanId: targetPlan.id, pendingBillingCycle: cycle, cancelAtPeriodEnd: false },
      include: { plan: true },
    });
    return { kind, subscription, appliedNow: false };
  }

  // upgrade or same → apply immediately.
  const amount = planPrice(targetPlan, cycle);
  const periodEnd = addCycle(now, cycle);
  const subscription = await prisma.subscription.update({
    where: { restaurantId },
    data: {
      planId: targetPlan.id,
      billingCycle: cycle,
      amount: new Prisma.Decimal(amount),
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      canceledAt: null,
      cancelAtPeriodEnd: false,
      pendingPlanId: null,
      pendingBillingCycle: null,
    },
    include: { plan: true },
  });

  if (kind === "upgrade" && isPaidPlan(targetPlan) && amount > 0) {
    await recordInvoice({
      restaurantId,
      subscriptionId: subscription.id,
      amount,
      currency: targetPlan.currency,
      status: "PAID",
      description: `Upgrade to ${targetPlan.name} — ${cycle.toLowerCase()}`,
      periodStart: now,
      periodEnd,
      paidAt: now,
      issuedAt: now,
    });
  }
  return { kind, subscription, appliedNow: true };
}

/** Cancel — at period end (default) or immediately. */
export async function cancelSubscription(input: {
  restaurantId: string;
  immediately?: boolean;
  now?: Date;
}): Promise<SubscriptionWithPlan> {
  const { restaurantId } = input;
  const now = input.now ?? new Date();
  if (input.immediately) {
    return prisma.subscription.update({
      where: { restaurantId },
      data: { status: "CANCELED", canceledAt: now, cancelAtPeriodEnd: false, pendingPlanId: null, pendingBillingCycle: null },
      include: { plan: true },
    });
  }
  return prisma.subscription.update({
    where: { restaurantId },
    data: { cancelAtPeriodEnd: true },
    include: { plan: true },
  });
}

/**
 * Resume / renew. Clears a pending cancellation, or reactivates a canceled /
 * expired subscription with a fresh period (raising an invoice for paid plans).
 */
export async function resumeSubscription(input: {
  restaurantId: string;
  now?: Date;
}): Promise<SubscriptionWithPlan> {
  const { restaurantId } = input;
  const now = input.now ?? new Date();
  const current = await prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  });
  if (!current) throw new Error("No subscription to resume");

  if (current.status === "CANCELED" || current.status === "EXPIRED") {
    return subscribeToPlan({
      restaurantId,
      plan: current.plan,
      cycle: current.billingCycle,
      status: "ACTIVE",
      now,
      withInvoice: true,
    });
  }
  // Active/trialing but flagged to cancel → just clear the flag.
  return prisma.subscription.update({
    where: { restaurantId },
    data: { cancelAtPeriodEnd: false },
    include: { plan: true },
  });
}

export interface RenewalSummary {
  renewed: number;
  canceled: number;
  downgraded: number;
  invoicesCreated: number;
}

/**
 * Advance every subscription whose period has ended. This is the manual billing
 * cron (run by scripts/process-renewals.ts): trials convert, pending downgrades
 * apply, cancellations finalise, and paid plans roll forward with a new invoice.
 * When Stripe drives billing, Stripe webhooks do this instead.
 */
export async function processRenewals(now: Date = new Date()): Promise<RenewalSummary> {
  const due = await prisma.subscription.findMany({
    where: {
      currentPeriodEnd: { lte: now },
      status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] },
    },
    include: { plan: true },
  });

  const summary: RenewalSummary = { renewed: 0, canceled: 0, downgraded: 0, invoicesCreated: 0 };

  for (const sub of due) {
    // Finalise a scheduled cancellation.
    if (sub.cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELED", canceledAt: now },
      });
      summary.canceled++;
      continue;
    }

    // Resolve the plan for the upcoming period (apply pending downgrade).
    let plan = sub.plan;
    let cycle = sub.billingCycle;
    if (sub.pendingPlanId) {
      const pending = await prisma.plan.findUnique({ where: { id: sub.pendingPlanId } });
      if (pending) {
        plan = pending;
        cycle = sub.pendingBillingCycle ?? sub.billingCycle;
        summary.downgraded++;
      }
    }

    const periodStart = sub.currentPeriodEnd;
    const periodEnd = addCycle(periodStart, cycle);
    const amount = planPrice(plan, cycle);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        billingCycle: cycle,
        amount: new Prisma.Decimal(amount),
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        pendingPlanId: null,
        pendingBillingCycle: null,
      },
    });
    summary.renewed++;

    if (isPaidPlan(plan) && amount > 0) {
      await recordInvoice({
        restaurantId: sub.restaurantId,
        subscriptionId: sub.id,
        amount,
        currency: plan.currency,
        status: "PAID",
        description: `${plan.name} renewal — ${cycle.toLowerCase()}`,
        periodStart,
        periodEnd,
        paidAt: now,
        issuedAt: now,
      });
      summary.invoicesCreated++;
    }
  }

  return summary;
}
