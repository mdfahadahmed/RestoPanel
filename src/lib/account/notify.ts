import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

/**
 * Customer-account notifications for the /account panel. These are generated as
 * a side-effect of order events and are intentionally best-effort: callers wrap
 * them in `.catch()` so a notification failure can never block an order write.
 */

const STATUS_MESSAGE: Record<OrderStatus, string> = {
  PENDING: "We've received your order and it's awaiting confirmation.",
  CONFIRMED: "Your order has been confirmed by the restaurant.",
  PREPARING: "Good news — the kitchen is preparing your order.",
  READY: "Your order is ready.",
  OUT_FOR_DELIVERY: "Your order is on its way.",
  DELIVERED: "Your order has been delivered. Enjoy!",
  CANCELLED: "Your order was cancelled.",
  REJECTED: "Sorry — your order was rejected by the restaurant.",
  REFUNDED: "Your order has been refunded.",
};

const STATUS_TITLE: Record<OrderStatus, string> = {
  PENDING: "Order received",
  CONFIRMED: "Order confirmed",
  PREPARING: "Order in the kitchen",
  READY: "Order ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Order delivered",
  CANCELLED: "Order cancelled",
  REJECTED: "Order rejected",
  REFUNDED: "Order refunded",
};

/**
 * Create an ORDER_UPDATE notification for the account that owns an order (if the
 * order's customer is linked to one, and the account has order updates enabled).
 */
export async function notifyAccountOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      restaurantId: true,
      restaurant: { select: { name: true } },
      customer: { select: { accountId: true } },
    },
  });
  const accountId = order?.customer?.accountId;
  if (!order || !accountId) return;

  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { notifyOrderUpdates: true },
  });
  if (!account?.notifyOrderUpdates) return;

  await prisma.customerNotification.create({
    data: {
      accountId,
      type: "ORDER_UPDATE",
      title: STATUS_TITLE[status],
      body: `#${order.orderNumber} · ${STATUS_MESSAGE[status]}`,
      orderId,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant.name,
      link: `/account/track/${orderId}`,
    },
  });
}

/** Notify an account that payment for one of its orders was received. */
export async function notifyAccountPaymentReceived(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      total: true,
      restaurantId: true,
      restaurant: { select: { name: true, currencySymbol: true } },
      customer: { select: { accountId: true } },
    },
  });
  const accountId = order?.customer?.accountId;
  if (!order || !accountId) return;

  await prisma.customerNotification.create({
    data: {
      accountId,
      type: "ORDER_UPDATE",
      title: "Payment received",
      body: `Payment of ${order.restaurant.currencySymbol}${Number(order.total).toFixed(2)} for order #${order.orderNumber} was received. Thank you!`,
      orderId,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant.name,
      link: `/account/orders/${orderId}`,
    },
  });
}

/** Notify an account that one of its orders was just placed. */
export async function notifyAccountOrderPlaced(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      total: true,
      restaurantId: true,
      restaurant: { select: { name: true } },
      customer: { select: { accountId: true } },
    },
  });
  const accountId = order?.customer?.accountId;
  if (!order || !accountId) return;

  await prisma.customerNotification.create({
    data: {
      accountId,
      type: "ORDER_UPDATE",
      title: "Order placed",
      body: `#${order.orderNumber} at ${order.restaurant.name} — we'll keep you posted.`,
      orderId,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurant.name,
      link: `/account/track/${orderId}`,
    },
  });
}
