import { Prisma } from "@prisma/client";
import type { PaymentTxnStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { round2 } from "@/lib/validations/order";
import { netPaid } from "@/lib/pos/sale";
import { notifyAccountPaymentReceived } from "@/lib/account/notify";
import { getGateway, resolveOnlineGateway } from "./index";
import { PaymentError, type OnlineProvider, type PaymentProvider } from "./types";

export interface StartPaymentResult {
  provider: PaymentProvider;
  intentId: string;
  clientSecret: string | null;
  status: PaymentTxnStatus;
  requiresAction: boolean;
  online: boolean;
}

/**
 * Begin payment for an order: pick the gateway from the order's method +
 * restaurant settings, create the provider intent, and record a PENDING (or
 * FAILED) SALE row in the payment ledger. Idempotent per order — re-calling
 * reuses the existing intent record instead of creating duplicates.
 *
 * COD → a PENDING ledger row, no online charge (settled later by staff).
 * Online → a PENDING intent whose client secret the storefront confirms; the
 * outcome arrives via the webhook (or the mock confirm action in dev/test).
 */
export async function startOrderPayment(
  orderId: string,
  opts?: { simulate?: "succeed" | "fail" }
): Promise<ActionResult<StartPaymentResult>> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      restaurantId: true,
      orderNumber: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      customerEmail: true,
      restaurant: {
        select: { currency: true, paymentProvider: true },
      },
    },
  });
  if (!order) return actionError("Order not found");
  if (order.paymentStatus === "PAID") {
    return actionError("This order is already paid");
  }

  const isCod = order.paymentMethod === "CASH";
  const gateway = isCod
    ? getGateway("cod")
    : await resolveOnlineGateway(order.restaurant.paymentProvider as OnlineProvider);

  // Idempotency: if an intent is already in progress for this order, resume it
  // rather than creating a second charge (important for Stripe on page reload).
  const inFlight = await prisma.payment.findFirst({
    where: { orderId: order.id, kind: "SALE", status: "PENDING", intentId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { intentId: true, provider: true },
  });
  if (inFlight?.intentId && inFlight.provider) {
    const g = getGateway(inFlight.provider as PaymentProvider);
    const resumed = await g.retrieve(inFlight.intentId);
    return actionOk({
      provider: inFlight.provider as PaymentProvider,
      intentId: inFlight.intentId,
      clientSecret: resumed.clientSecret ?? null,
      status: resumed.status,
      requiresAction: g.online,
      online: g.online,
    });
  }

  let result;
  try {
    result = await gateway.createIntent({
      amount: Number(order.total),
      currency: order.restaurant.currency,
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      description: `Order #${order.orderNumber}`,
      customerEmail: order.customerEmail,
      simulate: opts?.simulate,
    });
  } catch (err) {
    if (err instanceof PaymentError) return actionError(err.message);
    console.error("[payments] createIntent failed:", err);
    return actionError("Could not start payment. Please try again.");
  }

  const ledgerMethod: PaymentMethod = isCod
    ? "CASH"
    : order.paymentMethod === "ONLINE"
      ? "ONLINE"
      : "CARD";

  // Idempotent ledger row keyed by intent id. Only a still-PENDING row is
  // reused — a prior FAILED attempt is preserved as history (so retries after a
  // decline don't erase the failed payment).
  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, kind: "SALE", intentId: result.intentId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { status: result.status, provider: result.provider },
    });
  } else {
    await prisma.payment.create({
      data: {
        restaurantId: order.restaurantId,
        orderId: order.id,
        kind: "SALE",
        method: ledgerMethod,
        amount: new Prisma.Decimal(round2(Number(order.total))),
        provider: result.provider,
        status: result.status,
        intentId: result.intentId,
        failureReason: result.status === "FAILED" ? "Payment was declined" : null,
      },
    });
  }

  // An intent that succeeds synchronously (rare) settles immediately.
  if (result.status === "SUCCEEDED") {
    await applyPaidSideEffects(order.restaurantId, order.id);
  }

  return actionOk({
    provider: result.provider,
    intentId: result.intentId,
    clientSecret: result.clientSecret,
    status: result.status,
    requiresAction: result.requiresAction,
    online: gateway.online,
  });
}

/**
 * Settle a SALE intent — called by the payment webhook and by the mock confirm
 * action. Idempotent: a payment already SUCCEEDED is a no-op. On success the
 * order is marked PAID, an invoice is generated and the customer is notified. On
 * failure the row becomes FAILED (a "failed payment") and the order stays UNPAID.
 */
export async function settlePaymentByIntent(
  intentId: string,
  outcome: "succeeded" | "failed",
  details?: { cardLast4?: string | null; failureReason?: string | null; reference?: string | null }
): Promise<{ ok: boolean; orderId?: string; already?: boolean }> {
  const payment = await prisma.payment.findFirst({
    where: { intentId, kind: "SALE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderId: true, restaurantId: true, status: true },
  });
  if (!payment) return { ok: false };
  if (payment.status === "SUCCEEDED") {
    return { ok: true, orderId: payment.orderId, already: true };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: outcome === "succeeded" ? "SUCCEEDED" : "FAILED",
      cardLast4: details?.cardLast4 ?? undefined,
      reference: details?.reference ?? undefined,
      failureReason:
        outcome === "failed" ? details?.failureReason ?? "Payment failed" : null,
    },
  });

  if (outcome === "succeeded") {
    await applyPaidSideEffects(payment.restaurantId, payment.orderId);
  }
  return { ok: true, orderId: payment.orderId };
}

/** Mark the order PAID, generate its invoice, and notify the customer account. */
async function applyPaidSideEffects(restaurantId: string, orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: "PAID" },
  });
  await generateOrderInvoice(orderId);
  await notifyAccountPaymentReceived(orderId).catch(() => undefined);
}

/**
 * Staff action: settle an unpaid order manually (e.g. cash collected on delivery
 * for a COD order). Settles the pending SALE row, or records one if absent.
 */
export async function markOrderPaid(
  restaurantId: string,
  orderId: string
): Promise<ActionResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { id: true, total: true, paymentStatus: true, paymentMethod: true },
  });
  if (!order) return actionError("Order not found");
  if (order.paymentStatus === "PAID") return actionError("Order is already paid");

  const pending = await prisma.payment.findFirst({
    where: { restaurantId, orderId, kind: "SALE", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (pending) {
    await prisma.payment.update({
      where: { id: pending.id },
      data: { status: "SUCCEEDED" },
    });
  } else {
    await prisma.payment.create({
      data: {
        restaurantId,
        orderId,
        kind: "SALE",
        method: order.paymentMethod,
        amount: new Prisma.Decimal(round2(Number(order.total))),
        provider: "cod",
        status: "SUCCEEDED",
      },
    });
  }

  await applyPaidSideEffects(restaurantId, orderId);
  return actionOk();
}

/**
 * Refund a settled order (full or partial) through its original provider, record
 * a REFUND ledger row and mark the order REFUNDED. Cannot exceed the net amount
 * currently paid.
 */
export async function refundOrderPayment(
  restaurantId: string,
  orderId: string,
  opts?: { amount?: number; reason?: string }
): Promise<ActionResult<{ refunded: number }>> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { id: true },
  });
  if (!order) return actionError("Order not found");

  const sale = await prisma.payment.findFirst({
    where: { restaurantId, orderId, kind: "SALE", status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
    select: { id: true, method: true, provider: true, intentId: true },
  });
  if (!sale) return actionError("There is no settled payment to refund");

  const paid = await netPaid(restaurantId, orderId);
  if (paid <= 0) return actionError("Nothing left to refund");
  const amount = round2(opts?.amount != null ? Math.min(opts.amount, paid) : paid);
  if (!(amount > 0)) return actionError("Refund amount must be positive");

  const provider = (sale.provider ?? "cod") as PaymentProvider;
  const gateway = getGateway(provider);

  let refundRef: string | null = null;
  try {
    const r = await gateway.refund({
      intentId: sale.intentId ?? `${provider}_${orderId}`,
      amount,
      reason: opts?.reason,
    });
    refundRef = r.refundId;
  } catch (err) {
    if (err instanceof PaymentError) return actionError(err.message);
    console.error("[payments] refund failed:", err);
    return actionError("The refund could not be processed. Please try again.");
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        restaurantId,
        orderId,
        kind: "REFUND",
        method: sale.method,
        amount: new Prisma.Decimal(amount),
        provider,
        status: "SUCCEEDED",
        intentId: sale.intentId,
        reference: refundRef,
        note: opts?.reason || null,
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED" },
    }),
  ]);

  return actionOk({ refunded: amount });
}

/**
 * Allocate a tenant-unique invoice number for an order (idempotent). Retries on
 * the rare number collision, mirroring the billing invoice numbering.
 */
export async function generateOrderInvoice(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, restaurantId: true, invoiceNumber: true },
  });
  if (!order) return null;
  if (order.invoiceNumber) return order.invoiceNumber;

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const candidate = `INV-${year}-${rand}`;
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { invoiceNumber: candidate, invoicedAt: new Date() },
      });
      return candidate;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < 4
      ) {
        continue; // collision — regenerate
      }
      throw err;
    }
  }
  return null;
}

// --- History / reads --------------------------------------------------------

export interface ListPaymentsOptions {
  orderId?: string;
  status?: PaymentTxnStatus;
  failedOnly?: boolean;
  take?: number;
}

/** Payment history for a restaurant (optionally filtered — e.g. failed only). */
export function listPayments(restaurantId: string, opts: ListPaymentsOptions = {}) {
  return prisma.payment.findMany({
    where: {
      restaurantId,
      ...(opts.orderId ? { orderId: opts.orderId } : {}),
      ...(opts.failedOnly ? { status: "FAILED" } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    include: {
      order: { select: { orderNumber: true, customerName: true } },
    },
  });
}

/** All ledger rows for a single order (tenant-scoped). */
export function getOrderPayments(restaurantId: string, orderId: string) {
  return prisma.payment.findMany({
    where: { restaurantId, orderId },
    orderBy: { createdAt: "asc" },
  });
}

/** Aggregate payment stats for the dashboard (received, refunded, failed count). */
export async function paymentSummary(restaurantId: string) {
  const [received, refunded, failedCount] = await Promise.all([
    prisma.payment.aggregate({
      where: { restaurantId, kind: "SALE", status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { restaurantId, kind: "REFUND", status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { restaurantId, status: "FAILED" } }),
  ]);
  const grossReceived = Number(received._sum.amount ?? 0);
  const totalRefunded = Number(refunded._sum.amount ?? 0);
  return {
    grossReceived,
    totalRefunded,
    netReceived: round2(grossReceived - totalRefunded),
    failedCount,
  };
}
