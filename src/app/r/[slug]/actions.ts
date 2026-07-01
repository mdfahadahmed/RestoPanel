"use server";

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

// Public checkout — NO session. The restaurant is resolved from the public slug
// and every write is scoped to that restaurantId. Pricing/tax/delivery are taken
// from server-side data, never trusted from the client.
export async function placeOrderPublic(
  slug: string,
  input: unknown
): Promise<ActionResult<{ orderNumber: string }>> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true, taxRate: true, deliveryFee: true, minimumOrder: true, currencySymbol: true,
      deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true, temporaryClosure: true,
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
  if (data.couponCode) {
    const evalResult = await evaluateCoupon(restaurant.id, data.couponCode, itemResult.subtotal);
    if (!evalResult.ok) return actionError(evalResult.error);
    discount = evalResult.discount;
    appliedCouponId = evalResult.couponId;
    appliedCouponCode = evalResult.code;
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
    // Create the order and bump the coupon's usage atomically.
    const [created] = await prisma.$transaction([
      prisma.order.create({ data: orderData, select: { id: true } }),
      prisma.coupon.update({ where: { id: appliedCouponId }, data: { usedCount: { increment: 1 } } }),
    ]);
    createdOrderId = created.id;
  } else {
    const created = await prisma.order.create({ data: orderData, select: { id: true } });
    createdOrderId = created.id;
  }

  // Notify the customer account panel that the order was placed (best-effort).
  if (accountId) {
    await notifyAccountOrderPlaced(createdOrderId).catch(() => undefined);
  }

  return actionOk({ orderNumber });
}

// Public coupon preview for the checkout — re-validated server-side at checkout.
export async function validateCouponPublic(
  slug: string,
  code: string,
  subtotal: number
): Promise<ActionResult<{ code: string; discount: number }>> {
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
