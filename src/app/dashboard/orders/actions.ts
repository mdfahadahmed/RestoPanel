"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { buildOrderItems, nextOrderNumber } from "@/lib/orders/build";
import { notifyOrderStatus } from "@/lib/notifications/notify";
import { notifyAccountOrderStatus } from "@/lib/account/notify";
import { accrueForOrder } from "@/lib/loyalty/engine";
import { refundOrderPayment, markOrderPaid } from "@/lib/payments/service";
import {
  createOrderSchema,
  updateStatusSchema,
  updatePaymentSchema,
  updateNotesSchema,
  canTransition,
  computeTotals,
} from "@/lib/validations/order";

export async function createOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const itemResult = await buildOrderItems(restaurantId, data.items);
  if (!itemResult.ok) return actionError(itemResult.error);

  const totals = computeTotals(
    itemResult.subtotal,
    data.discountAmount,
    data.taxAmount,
    data.type === "DELIVERY" ? data.deliveryFee : 0
  );

  // Resolve / snapshot the customer (tenant-scoped).
  let customerId: string | null = null;
  let customerName = data.customerName || null;
  let customerPhone = data.customerPhone || null;
  let customerEmail = data.customerEmail || null;

  if (data.customerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: data.customerId, restaurantId },
    });
    if (!existing) return actionError("Selected customer was not found");
    customerId = existing.id;
    customerName = customerName ?? existing.name;
    customerPhone = customerPhone ?? existing.phone;
    customerEmail = customerEmail ?? existing.email;
  } else if (customerPhone) {
    // Upsert a customer by tenant + phone so repeat walk-ins are linked.
    const customer = await prisma.customer.upsert({
      where: { restaurantId_phone: { restaurantId, phone: customerPhone } },
      update: {
        name: customerName ?? undefined,
        email: customerEmail ?? undefined,
      },
      create: {
        restaurantId,
        phone: customerPhone,
        name: customerName,
        email: customerEmail,
      },
    });
    customerId = customer.id;
  }

  const orderNumber = await nextOrderNumber(restaurantId);

  const created = await prisma.order.create({
    data: {
      restaurantId,
      customerId,
      orderNumber,
      type: data.type,
      status: "PENDING",
      customerName,
      customerPhone,
      customerEmail,
      address: data.address || null,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      subtotal: new Prisma.Decimal(totals.subtotal),
      discountAmount: new Prisma.Decimal(totals.discountAmount),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      deliveryFee: new Prisma.Decimal(totals.deliveryFee),
      total: new Prisma.Decimal(totals.total),
      notes: data.notes || null,
      restaurantNotes: data.restaurantNotes || null,
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
      events: {
        create: { status: "PENDING", note: "Order created" },
      },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/orders");
  return actionOk({ id: created.id });
}

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const { id, status, note } = parsed.data;

  const order = await prisma.order.findFirst({
    where: { id, restaurantId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!order) return actionError("Order not found");

  if (order.status === status) return actionError("Order is already in that status");
  if (!canTransition(order.status, status)) {
    return actionError(`Cannot move an order from ${order.status} to ${status}`);
  }

  // A refund also marks the payment refunded.
  const paymentStatus = status === "REFUNDED" ? ("REFUNDED" as const) : undefined;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status, ...(paymentStatus ? { paymentStatus } : {}) },
    }),
    prisma.orderEvent.create({
      data: { orderId: order.id, status, note: note || null },
    }),
  ]);

  // Fire the customer notification for this status (best-effort, non-blocking).
  await notifyOrderStatus(order.id, status).catch(() => undefined);
  // Mirror it into the customer account panel (/account), best-effort.
  await notifyAccountOrderStatus(order.id, status).catch(() => undefined);

  // Award loyalty points/cashback once an order is completed (idempotent).
  if (status === "DELIVERED") {
    await accrueForOrder(restaurantId, order.id).catch(() => undefined);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
  return actionOk();
}

export async function updatePayment(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const { id, paymentStatus, paymentMethod } = parsed.data;
  if (!paymentStatus && !paymentMethod) return actionError("Nothing to update");

  const res = await prisma.order.updateMany({
    where: { id, restaurantId },
    data: {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
    },
  });
  if (res.count === 0) return actionError("Order not found");

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  return actionOk();
}

export async function refundOrder(input: {
  id: string;
  amount?: number;
  reason?: string;
}): Promise<ActionResult<{ refunded: number }>> {
  const { restaurantId } = await requireTenant();
  if (!input?.id) return actionError("Invalid request");
  const result = await refundOrderPayment(restaurantId, input.id, {
    amount: input.amount,
    reason: input.reason,
  });
  if (result.ok) {
    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${input.id}`);
  }
  return result;
}

export async function markOrderPaidAction(input: { id: string }): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  if (!input?.id) return actionError("Invalid request");
  const result = await markOrderPaid(restaurantId, input.id);
  if (result.ok) {
    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${input.id}`);
  }
  return result;
}

export async function updateRestaurantNotes(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateNotesSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await prisma.order.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { restaurantNotes: parsed.data.restaurantNotes || null },
  });
  if (res.count === 0) return actionError("Order not found");

  revalidatePath(`/dashboard/orders/${parsed.data.id}`);
  return actionOk();
}
