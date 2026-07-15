"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { buildOrderItems, nextOrderNumber } from "@/lib/orders/build";
import { computeTotals, round2 } from "@/lib/validations/order";
import { checkoutSchema, reservationSchema } from "@/lib/validations/storefront";
import { createReviewSchema } from "@/lib/validations/review";
import { evaluateCoupon } from "@/lib/coupons/evaluate";
import { notifyReservation } from "@/lib/notifications/notify";
import { createReservation, getDayAvailability } from "@/lib/reservations/bookings";
import { getCustomerSession } from "@/lib/account/context";
import { notifyAccountOrderPlaced } from "@/lib/account/notify";
import { settlePaymentByIntent } from "@/lib/payments/service";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { isTrustedOrigin } from "@/lib/security/origin";

// Thrown inside the order transaction to roll back when a coupon's usage limit
// was exhausted concurrently between validation and the guarded increment.
class CouponLimitReachedError extends Error {}

/**
 * Abuse protection for the public (unauthenticated) storefront actions: reject
 * cross-origin POSTs (CSRF) and throttle by client IP. Reused across order,
 * coupon, reservation and review submission.
 *
 * Fails open when there's no request context (e.g. the test harness calls these
 * actions directly, where `headers()` throws) — production always has one.
 */
async function publicGuard(
  buckets: { key: string; limit: number }[]
): Promise<ActionResult<never> | null> {
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch {
    return null; // no request context (tests/CI) → skip guarding
  }
  if (!isTrustedOrigin(h)) {
    return actionError("Your request could not be verified. Please refresh and try again.");
  }
  const ip = getClientIp(h) ?? "?";
  for (const b of buckets) {
    const res = await checkRateLimit(`${b.key}:${ip}`, b.limit);
    if (!res.allowed) {
      return actionError("Too many requests. Please slow down and try again in a minute.");
    }
  }
  return null;
}

// Public checkout — NO session. The restaurant is resolved from the public slug
// and every write is scoped to that restaurantId. Pricing/tax/delivery are taken
// from server-side data, never trusted from the client.
export async function placeOrderPublic(
  slug: string,
  input: unknown
): Promise<ActionResult<{ orderNumber: string; orderId: string; online: boolean }>> {
  const blocked = await publicGuard([
    { key: `store:order:ip`, limit: 12 },
    { key: `store:order:slug:${slug}`, limit: 40 },
  ]);
  if (blocked) return blocked;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true, taxRate: true, deliveryFee: true, minimumOrder: true, currencySymbol: true,
      deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true, temporaryClosure: true,
      onlinePaymentsEnabled: true, codEnabled: true,
    },
  });
  if (!restaurant) return actionError("Restaurant not found");

  // Block ordering during a temporary closure.
  const closure = (restaurant.temporaryClosure as { enabled?: boolean; message?: string } | null) ?? null;
  if (closure?.enabled) {
    return actionError(closure.message || "This restaurant is temporarily closed for orders");
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // Respect the restaurant's enabled order types.
  const typeEnabled =
    (data.type === "DELIVERY" && restaurant.deliveryEnabled) ||
    (data.type === "PICKUP" && restaurant.pickupEnabled) ||
    (data.type === "DINE_IN" && restaurant.dineInEnabled);
  if (!typeEnabled) return actionError("That order type isn't available right now");

  // Respect the restaurant's payment settings.
  const wantsOnline = data.paymentMethod !== "CASH";
  if (wantsOnline && !restaurant.onlinePaymentsEnabled) {
    return actionError("Online payment isn't available for this restaurant right now");
  }
  if (!wantsOnline && !restaurant.codEnabled) {
    return actionError("Cash on delivery isn't available for this restaurant right now");
  }

  const itemResult = await buildOrderItems(restaurant.id, data.items);
  if (!itemResult.ok) return actionError(itemResult.error);

  // Enforce minimum delivery order.
  const minimum = Number(restaurant.minimumOrder);
  if (data.type === "DELIVERY" && minimum > 0 && itemResult.subtotal < minimum) {
    return actionError(`Minimum delivery order is ${restaurant.currencySymbol}${minimum.toFixed(2)}`);
  }

  // Apply a coupon if one was entered (server-authoritative, re-validated here).
  let discount = 0;
  let appliedCouponId: string | null = null;
  let appliedCouponCode: string | null = null;
  let appliedCouponUsageLimit: number | null = null;
  if (data.couponCode) {
    const evalResult = await evaluateCoupon(restaurant.id, data.couponCode, itemResult.subtotal);
    if (!evalResult.ok) return actionError(evalResult.error);
    discount = evalResult.discount;
    appliedCouponId = evalResult.couponId;
    appliedCouponCode = evalResult.code;
    appliedCouponUsageLimit = evalResult.usageLimit;
  }

  const taxRate = Number(restaurant.taxRate);
  // Tax applies to the discounted subtotal.
  const taxAmount = round2(((itemResult.subtotal - discount) * taxRate) / 100);
  const deliveryFee = data.type === "DELIVERY" ? Number(restaurant.deliveryFee) : 0;
  const totals = computeTotals(itemResult.subtotal, discount, taxAmount, deliveryFee);

  // If the shopper is signed in to their customer account (/account), link this
  // restaurant's Customer profile to it so the order shows in their history.
  // Guarded: outside a request context (e.g. tests) reading cookies throws — we
  // simply treat that as "no account".
  let accountId: string | null = null;
  try {
    const session = await getCustomerSession();
    accountId = session?.accountId ?? null;
  } catch {
    accountId = null;
  }

  // Link or create the customer by phone (tenant-scoped).
  const customer = await prisma.customer.upsert({
    where: { restaurantId_phone: { restaurantId: restaurant.id, phone: data.customerPhone } },
    update: {
      name: data.customerName || undefined,
      email: data.customerEmail || undefined,
      address: data.address || undefined,
      ...(accountId ? { accountId } : {}),
    },
    create: {
      restaurantId: restaurant.id,
      phone: data.customerPhone,
      name: data.customerName,
      email: data.customerEmail || null,
      address: data.address || null,
      accountId,
    },
  });

  const orderNumber = await nextOrderNumber(restaurant.id);

  const orderData = {
    restaurantId: restaurant.id,
    customerId: customer.id,
    orderNumber,
    type: data.type,
    status: "PENDING" as const,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail || null,
    address: data.address || null,
    paymentMethod: data.paymentMethod,
    paymentStatus: "UNPAID" as const,
    couponCode: appliedCouponCode,
    subtotal: new Prisma.Decimal(totals.subtotal),
    discountAmount: new Prisma.Decimal(totals.discountAmount),
    taxAmount: new Prisma.Decimal(totals.taxAmount),
    deliveryFee: new Prisma.Decimal(totals.deliveryFee),
    total: new Prisma.Decimal(totals.total),
    notes: data.notes || null,
    items: {
      create: itemResult.built.map((b) => ({
        productId: b.productId,
        nameSnapshot: b.nameSnapshot,
        unitPrice: new Prisma.Decimal(b.unitPrice),
        quantity: b.quantity,
        lineTotal: new Prisma.Decimal(b.lineTotal),
        options: b.options as unknown as Prisma.InputJsonValue,
      })),
    },
    events: { create: { status: "PENDING" as const, note: "Order placed online" } },
  };

  let createdOrderId: string;
  if (appliedCouponId) {
    // Create the order and bump the coupon's usage atomically. The increment is
    // guarded by the usage limit inside the transaction so two concurrent
    // checkouts can't both slip past a nearly-exhausted coupon (TOCTOU): if the
    // guarded update matches nothing, the limit was hit and we roll back.
    try {
      createdOrderId = await prisma.$transaction(async (tx) => {
        const bumped = await tx.coupon.updateMany({
          where:
            appliedCouponUsageLimit == null
              ? { id: appliedCouponId! }
              : { id: appliedCouponId!, usedCount: { lt: appliedCouponUsageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (bumped.count === 0) throw new CouponLimitReachedError();
        const created = await tx.order.create({ data: orderData, select: { id: true } });
        return created.id;
      });
    } catch (e) {
      if (e instanceof CouponLimitReachedError) {
        return actionError("This coupon has reached its usage limit");
      }
      throw e;
    }
  } else {
    const created = await prisma.order.create({ data: orderData, select: { id: true } });
    createdOrderId = created.id;
  }

  // Notify the customer account panel that the order was placed (best-effort).
  if (accountId) {
    await notifyAccountOrderPlaced(createdOrderId).catch(() => undefined);
  }

  // `online` tells the client to route to the payment step; COD orders are done.
  return actionOk({ orderNumber, orderId: createdOrderId, online: wantsOnline });
}

/**
 * Confirm an in-progress online payment for a storefront order. Used by the pay
 * page's mock/test flow (real Stripe payments are confirmed with Stripe.js and
 * settled by the webhook, so this only acts on the deterministic mock provider).
 * Scoped by the public slug — an order must belong to the given restaurant.
 */
export async function confirmMockPaymentPublic(
  slug: string,
  orderId: string,
  outcome: "succeed" | "fail" = "succeed"
): Promise<ActionResult<{ status: string }>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return actionError("Restaurant not found");

  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      order: { restaurantId: restaurant.id },
      kind: "SALE",
      status: "PENDING",
      provider: "mock",
    },
    orderBy: { createdAt: "desc" },
    select: { intentId: true },
  });
  if (!payment?.intentId) {
    return actionError("No pending test payment for this order");
  }

  const res = await settlePaymentByIntent(
    payment.intentId,
    outcome === "fail" ? "failed" : "succeeded",
    outcome === "fail" ? { failureReason: "Test payment declined" } : { cardLast4: "4242" }
  );
  if (!res.ok) return actionError("Could not confirm the payment");
  return actionOk({ status: outcome === "fail" ? "FAILED" : "SUCCEEDED" });
}

// Public coupon preview for the checkout — re-validated server-side at checkout.
export async function validateCouponPublic(
  slug: string,
  code: string,
  subtotal: number
): Promise<ActionResult<{ code: string; discount: number }>> {
  // Tighter per-IP limit: this is the surface a bot would use to brute-force codes.
  const blocked = await publicGuard([{ key: `store:coupon:ip`, limit: 15 }]);
  if (blocked) return blocked;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return actionError("Restaurant not found");
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const result = await evaluateCoupon(restaurant.id, code, safeSubtotal);
  if (!result.ok) return actionError(result.error);
  return actionOk({ code: result.code, discount: result.discount });
}

/** Public: available time slots for a date + party size (for the booking form). */
export async function getAvailableSlotsPublic(
  slug: string,
  date: string,
  partySize: number
): Promise<ActionResult<{ slots: string[] }>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return actionError("Restaurant not found");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return actionError("Invalid date");

  const { slots } = await getDayAvailability(restaurant.id, date, Math.max(1, Number(partySize) || 1));
  return actionOk({ slots: slots.filter((s) => s.available).map((s) => s.time) });
}

export async function createReservationPublic(
  slug: string,
  input: unknown
): Promise<ActionResult<{ reference: string }>> {
  const blocked = await publicGuard([{ key: `store:reservation:ip`, limit: 8 }]);
  if (blocked) return blocked;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return actionError("Restaurant not found");

  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // Availability + table assignment handled by the shared booking engine.
  const result = await createReservation({
    restaurantId: restaurant.id,
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    date: data.date,
    time: data.time,
    partySize: data.partySize,
    notes: data.notes || null,
    source: "WEBSITE",
    enforceSlot: true,
  });
  if (!result.ok) return actionError(result.error);

  // Confirm to the guest (best-effort, non-blocking).
  await notifyReservation(result.id).catch(() => undefined);

  return actionOk({ reference: result.reference });
}

// Public review submission, tied to a delivered order (one review per order).
export async function createReviewPublic(slug: string, input: unknown): Promise<ActionResult> {
  const blocked = await publicGuard([{ key: `store:review:ip`, limit: 8 }]);
  if (blocked) return blocked;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (!restaurant) return actionError("Restaurant not found");

  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const order = await prisma.order.findFirst({
    where: { restaurantId: restaurant.id, orderNumber: data.orderNumber },
    select: { id: true, status: true, customerId: true, customerName: true, review: { select: { id: true } } },
  });
  if (!order) return actionError("Order not found");
  if (order.status !== "DELIVERED") return actionError("You can review an order once it's delivered");
  if (order.review) return actionError("You've already reviewed this order");

  await prisma.review.create({
    data: {
      restaurantId: restaurant.id,
      orderId: order.id,
      customerId: order.customerId,
      customerName: data.name?.trim() || order.customerName || "Customer",
      rating: data.rating,
      comment: data.comment?.trim() || null,
      isPublished: true,
    },
  });

  return actionOk();
}
