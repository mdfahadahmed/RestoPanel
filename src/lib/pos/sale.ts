import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOrderItems, nextOrderNumber } from "@/lib/orders/build";
import { computeTotals, round2, type OrderItemInput } from "@/lib/validations/order";
import { applyDiscount, computeChange, type DiscountInput, type TenderInput } from "@/lib/pos/shared";

export * from "@/lib/pos/shared";

export interface WalkInSaleInput {
  items: OrderItemInput[];
  type?: "DINE_IN" | "PICKUP";
  customerName?: string | null;
  discount?: DiscountInput | null;
  note?: string | null;
}

export type CreateSaleResult =
  | { ok: true; orderId: string; orderNumber: string; total: number }
  | { ok: false; error: string };

/**
 * Create a walk-in POS order with server-authoritative pricing. Tax comes from
 * the restaurant's `taxRate` (applied to the discounted subtotal, mirroring the
 * storefront). The order opens as CONFIRMED + UNPAID so it flows to the kitchen
 * (KDS) and is then settled via {@link recordPayments}.
 */
export async function createWalkInSale(
  restaurantId: string,
  input: WalkInSaleInput
): Promise<CreateSaleResult> {
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "Add at least one item" };
  }

  const itemResult = await buildOrderItems(restaurantId, input.items);
  if (!itemResult.ok) return { ok: false, error: itemResult.error };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { taxRate: true },
  });
  if (!restaurant) return { ok: false, error: "Restaurant not found" };

  const discountAmount = applyDiscount(itemResult.subtotal, input.discount);
  const taxRate = Number(restaurant.taxRate);
  const taxAmount = round2(((itemResult.subtotal - discountAmount) * taxRate) / 100);
  const totals = computeTotals(itemResult.subtotal, discountAmount, taxAmount, 0);

  const orderNumber = await nextOrderNumber(restaurantId);

  const created = await prisma.order.create({
    data: {
      restaurantId,
      orderNumber,
      type: input.type ?? "DINE_IN",
      status: "CONFIRMED",
      customerName: input.customerName || "Walk-in",
      paymentMethod: "CASH",
      paymentStatus: "UNPAID",
      subtotal: new Prisma.Decimal(totals.subtotal),
      discountAmount: new Prisma.Decimal(totals.discountAmount),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      deliveryFee: new Prisma.Decimal(0),
      total: new Prisma.Decimal(totals.total),
      notes: input.note || null,
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
      events: { create: { status: "CONFIRMED", note: "POS walk-in sale" } },
    },
    select: { id: true, orderNumber: true },
  });

  return { ok: true, orderId: created.id, orderNumber: created.orderNumber, total: totals.total };
}

/** Look up a product within the tenant by its barcode or SKU (orderable only). */
export async function findProductByCode(restaurantId: string, code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return prisma.product.findFirst({
    where: {
      restaurantId,
      deletedAt: null,
      status: "ACTIVE",
      isAvailable: true,
      OR: [{ barcode: trimmed }, { sku: trimmed }],
    },
    select: { id: true, name: true, price: true, discount: true, barcode: true, sku: true },
  });
}

/** Net amount settled on an order so far: paid sales minus refunds. */
export async function netPaid(restaurantId: string, orderId: string): Promise<number> {
  const rows = await prisma.payment.findMany({
    where: { restaurantId, orderId },
    select: { kind: true, amount: true },
  });
  const total = rows.reduce(
    (sum, p) => sum + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)),
    0
  );
  return round2(total);
}

export type PaymentResult =
  | { ok: true; paid: number; change: number; fullyPaid: boolean }
  | { ok: false; error: string };

/**
 * Record one or more tenders against an order (split bill = many tenders). Cash
 * tenders post a SALE movement to the given open drawer session and compute
 * change; card/online tenders don't touch the drawer. Marks the order PAID once
 * the net settled amount covers its total.
 */
export async function recordPayments(
  restaurantId: string,
  orderId: string,
  tenders: TenderInput[],
  drawerSessionId?: string | null
): Promise<PaymentResult> {
  if (!tenders || tenders.length === 0) return { ok: false, error: "No payment provided" };

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { id: true, total: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  for (const t of tenders) {
    if (!(Number(t.amount) > 0)) return { ok: false, error: "Payment amounts must be positive" };
  }

  const data = tenders.map((t) => {
    const amount = round2(Number(t.amount));
    const isCash = t.method === "CASH";
    const change = isCash && t.tendered != null ? computeChange(Number(t.tendered), amount) : null;
    return {
      restaurantId,
      orderId,
      drawerSessionId: drawerSessionId ?? null,
      kind: "SALE" as const,
      method: t.method,
      amount: new Prisma.Decimal(amount),
      tendered: isCash && t.tendered != null ? new Prisma.Decimal(round2(Number(t.tendered))) : null,
      changeGiven: change != null ? new Prisma.Decimal(change) : null,
      cardLast4: t.cardLast4 ?? null,
      reference: t.reference ?? null,
    };
  });

  await prisma.payment.createMany({ data });

  // Cash tenders move physical cash into the drawer (the amount applied, not the
  // tendered note).
  if (drawerSessionId) {
    const cashMovements = tenders
      .filter((t) => t.method === "CASH")
      .map((t) => ({
        restaurantId,
        drawerSessionId,
        type: "SALE" as const,
        amount: new Prisma.Decimal(round2(Number(t.amount))),
        orderId,
      }));
    if (cashMovements.length > 0) {
      await prisma.drawerMovement.createMany({ data: cashMovements });
    }
  }

  const paid = await netPaid(restaurantId, orderId);
  const fullyPaid = paid + 0.0001 >= Number(order.total);
  const lastMethod = tenders[tenders.length - 1].method;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: lastMethod === "ONLINE" ? "ONLINE" : lastMethod,
      ...(fullyPaid ? { paymentStatus: "PAID" as const } : {}),
    },
  });

  const change = round2(data.reduce((s, d) => s + (d.changeGiven ? Number(d.changeGiven) : 0), 0));
  return { ok: true, paid, change, fullyPaid };
}

export interface RefundInput {
  method: "CASH" | "CARD";
  amount?: number; // defaults to the full net-paid amount
  reason?: string;
}

export type RefundResult = { ok: true; refunded: number } | { ok: false; error: string };

/**
 * Refund an order (full or partial). Records a REFUND payment, pays cash out of
 * the drawer when applicable, and marks the order's payment REFUNDED. Cannot
 * exceed the net amount currently paid.
 */
export async function refundSale(
  restaurantId: string,
  orderId: string,
  input: RefundInput,
  drawerSessionId?: string | null
): Promise<RefundResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { id: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const paid = await netPaid(restaurantId, orderId);
  if (paid <= 0) return { ok: false, error: "Nothing to refund" };

  const amount = round2(input.amount != null ? Math.min(input.amount, paid) : paid);
  if (!(amount > 0)) return { ok: false, error: "Refund amount must be positive" };

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        restaurantId,
        orderId,
        drawerSessionId: drawerSessionId ?? null,
        kind: "REFUND",
        method: input.method,
        amount: new Prisma.Decimal(amount),
        note: input.reason || null,
      },
    });

    if (input.method === "CASH" && drawerSessionId) {
      await tx.drawerMovement.create({
        data: {
          restaurantId,
          drawerSessionId,
          type: "REFUND",
          amount: new Prisma.Decimal(-amount), // cash paid out
          orderId,
          reason: input.reason || null,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REFUNDED" },
    });
  });

  return { ok: true, refunded: amount };
}
