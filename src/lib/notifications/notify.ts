import type { NotificationEvent, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EVENT_META } from "./templates";
import { dispatchNotification, type DispatchResult } from "./dispatch";

/**
 * High-level, best-effort notification helpers used by the order/reservation/
 * signup flows. They never throw — a notification failure must never break the
 * underlying business action — and resolve recipients/context from the DB.
 */

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Order statuses that trigger a customer notification. */
export const ORDER_STATUS_EVENT: Partial<Record<OrderStatus, NotificationEvent>> = {
  CONFIRMED: "ORDER_CONFIRMED",
  PREPARING: "ORDER_PREPARING",
  READY: "ORDER_READY",
  DELIVERED: "ORDER_DELIVERED",
};

export async function notifyOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<DispatchResult[]> {
  const event = ORDER_STATUS_EVENT[status];
  if (!event) return [];

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      restaurantId: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      total: true,
      restaurant: { select: { name: true, slug: true, currencySymbol: true } },
    },
  });
  if (!order) return [];

  const context = {
    customerName: order.customerName ?? "there",
    restaurantName: order.restaurant.name,
    orderNumber: order.orderNumber,
    total: `${order.restaurant.currencySymbol}${Number(order.total).toFixed(2)}`,
    trackUrl: `${baseUrl()}/r/${order.restaurant.slug}/track/${order.orderNumber}`,
  };

  const results: DispatchResult[] = [];
  for (const channel of EVENT_META[event].channels) {
    const recipient = channel === "EMAIL" ? order.customerEmail : order.customerPhone;
    try {
      results.push(
        await dispatchNotification({
          restaurantId: order.restaurantId,
          event,
          channel,
          recipient,
          context,
          senderName: order.restaurant.name,
        })
      );
    } catch {
      /* best-effort */
    }
  }
  return results;
}

export async function notifyReservation(reservationId: string): Promise<DispatchResult[]> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      restaurantId: true,
      name: true,
      phone: true,
      email: true,
      date: true,
      partySize: true,
      reference: true,
      restaurant: { select: { name: true } },
    },
  });
  if (!r) return [];

  const context = {
    customerName: r.name,
    restaurantName: r.restaurant.name,
    date: r.date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    partySize: r.partySize,
    reference: r.reference ?? "",
  };

  const results: DispatchResult[] = [];
  for (const channel of EVENT_META.RESERVATION.channels) {
    const recipient = channel === "EMAIL" ? r.email : r.phone;
    try {
      results.push(
        await dispatchNotification({
          restaurantId: r.restaurantId,
          event: "RESERVATION",
          channel,
          recipient,
          context,
          senderName: r.restaurant.name,
        })
      );
    } catch {
      /* best-effort */
    }
  }
  return results;
}

/** Notify a customer about a reservation lifecycle change (approve/reject/reschedule). */
export async function notifyReservationStatus(
  reservationId: string,
  event: "RESERVATION_CONFIRMED" | "RESERVATION_REJECTED" | "RESERVATION_RESCHEDULED",
  extra?: { reason?: string }
): Promise<DispatchResult[]> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      restaurantId: true,
      name: true,
      phone: true,
      email: true,
      date: true,
      partySize: true,
      reference: true,
      table: { select: { name: true } },
      restaurant: { select: { name: true } },
    },
  });
  if (!r) return [];

  const context = {
    customerName: r.name,
    restaurantName: r.restaurant.name,
    date: r.date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    partySize: r.partySize,
    reference: r.reference ?? "",
    tableName: r.table?.name ?? "to be assigned",
    reason: extra?.reason ?? "",
  };

  const results: DispatchResult[] = [];
  for (const channel of EVENT_META[event].channels) {
    const recipient = channel === "EMAIL" ? r.email : r.phone;
    try {
      results.push(
        await dispatchNotification({
          restaurantId: r.restaurantId,
          event,
          channel,
          recipient,
          context,
          senderName: r.restaurant.name,
        })
      );
    } catch {
      /* best-effort */
    }
  }
  return results;
}

export async function sendWelcomeEmail(
  restaurantId: string,
  ownerEmail: string,
  ownerName: string
): Promise<DispatchResult[]> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  });
  if (!restaurant) return [];

  const context = {
    ownerName,
    restaurantName: restaurant.name,
    dashboardUrl: `${baseUrl()}/dashboard`,
  };

  try {
    const result = await dispatchNotification({
      restaurantId,
      event: "WELCOME",
      channel: "EMAIL",
      recipient: ownerEmail,
      context,
      senderName: restaurant.name,
    });
    return [result];
  } catch {
    return [];
  }
}
