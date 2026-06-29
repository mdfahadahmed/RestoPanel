import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordInvoice } from "./invoices";

/**
 * Maps Stripe webhook events onto local subscription/invoice state. Pure DB
 * logic given a parsed event object, with once-only processing via the
 * ProcessedWebhook table — so it can be unit-tested without hitting Stripe.
 */

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  incomplete: "PAST_DUE",
  paused: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "EXPIRED",
};

function unixToDate(v: unknown): Date | null {
  return typeof v === "number" ? new Date(v * 1000) : null;
}

export interface ProcessResult {
  handled: boolean;
  duplicate?: boolean;
  type: string;
}

export async function processStripeEvent(event: StripeEvent): Promise<ProcessResult> {
  const seen = await prisma.processedWebhook.findUnique({ where: { id: event.id } });
  if (seen) return { handled: true, duplicate: true, type: event.type };

  let handled = true;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await markSubscription(event.data.object, "CANCELED");
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await syncPaidInvoice(event.data.object);
      break;
    case "invoice.payment_failed":
      await markSubscriptionByCustomer(event.data.object, "PAST_DUE");
      break;
    default:
      handled = false;
  }

  await prisma.processedWebhook.create({ data: { id: event.id, type: event.type } });
  return { handled, type: event.type };
}

async function findLocalSubscription(stripeSub: Record<string, unknown>) {
  const subId = String(stripeSub.id ?? "");
  const customer = typeof stripeSub.customer === "string" ? stripeSub.customer : "";
  return prisma.subscription.findFirst({
    where: {
      OR: [
        subId ? { stripeSubscriptionId: subId } : undefined,
        customer ? { stripeCustomerId: customer } : undefined,
      ].filter(Boolean) as Prisma.SubscriptionWhereInput[],
    },
  });
}

async function syncSubscription(stripeSub: Record<string, unknown>) {
  const local = await findLocalSubscription(stripeSub);
  if (!local) return;

  const status = STATUS_MAP[String(stripeSub.status)] ?? local.status;
  const items = (stripeSub.items as { data?: { price?: { id?: string; unit_amount?: number } }[] })?.data ?? [];
  const price = items[0]?.price;

  // Match the Stripe price to a local plan + cycle.
  let planId = local.planId;
  let billingCycle: BillingCycle = local.billingCycle;
  let amount = Number(local.amount);
  if (price?.id) {
    const plan = await prisma.plan.findFirst({
      where: { OR: [{ stripePriceMonthlyId: price.id }, { stripePriceYearlyId: price.id }] },
    });
    if (plan) {
      planId = plan.id;
      billingCycle = plan.stripePriceYearlyId === price.id ? "YEARLY" : "MONTHLY";
    }
    if (typeof price.unit_amount === "number") amount = price.unit_amount / 100;
  }

  await prisma.subscription.update({
    where: { id: local.id },
    data: {
      status,
      planId,
      billingCycle,
      amount: new Prisma.Decimal(amount),
      stripeSubscriptionId: String(stripeSub.id ?? local.stripeSubscriptionId ?? ""),
      stripePriceId: price?.id ?? local.stripePriceId,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      currentPeriodStart: unixToDate(stripeSub.current_period_start) ?? local.currentPeriodStart,
      currentPeriodEnd: unixToDate(stripeSub.current_period_end) ?? local.currentPeriodEnd,
      canceledAt: status === "CANCELED" ? unixToDate(stripeSub.canceled_at) ?? new Date() : local.canceledAt,
    },
  });
}

async function markSubscription(stripeSub: Record<string, unknown>, status: SubscriptionStatus) {
  const local = await findLocalSubscription(stripeSub);
  if (!local) return;
  await prisma.subscription.update({
    where: { id: local.id },
    data: { status, canceledAt: status === "CANCELED" ? new Date() : local.canceledAt },
  });
}

async function markSubscriptionByCustomer(invoice: Record<string, unknown>, status: SubscriptionStatus) {
  const customer = typeof invoice.customer === "string" ? invoice.customer : "";
  if (!customer) return;
  const local = await prisma.subscription.findFirst({ where: { stripeCustomerId: customer } });
  if (!local) return;
  await prisma.subscription.update({ where: { id: local.id }, data: { status } });
}

async function syncPaidInvoice(invoice: Record<string, unknown>) {
  const customer = typeof invoice.customer === "string" ? invoice.customer : "";
  if (!customer) return;
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customer } });
  if (!sub) return;

  const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid / 100 : 0;
  await recordInvoice({
    restaurantId: sub.restaurantId,
    subscriptionId: sub.id,
    amount: amountPaid,
    currency: typeof invoice.currency === "string" ? invoice.currency.toUpperCase() : "GBP",
    status: "PAID",
    description: typeof invoice.description === "string" ? invoice.description : "Subscription payment",
    periodStart: unixToDate((invoice.lines as { data?: { period?: { start?: number } }[] })?.data?.[0]?.period?.start),
    periodEnd: unixToDate((invoice.lines as { data?: { period?: { end?: number } }[] })?.data?.[0]?.period?.end),
    paidAt: new Date(),
    stripeInvoiceId: typeof invoice.id === "string" ? invoice.id : undefined,
    hostedUrl: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : undefined,
    pdfUrl: typeof invoice.invoice_pdf === "string" ? invoice.invoice_pdf : undefined,
  });
}
