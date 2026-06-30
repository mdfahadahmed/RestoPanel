"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { orderItemInputSchema } from "@/lib/validations/order";
import {
  createWalkInSale,
  recordPayments,
  refundSale,
  findProductByCode,
  type TenderInput,
} from "@/lib/pos/sale";
import {
  openDrawer,
  closeDrawer,
  addDrawerMovement,
  getOpenDrawer,
} from "@/lib/pos/drawer";

const discountSchema = z.object({
  kind: z.enum(["AMOUNT", "PERCENT"]),
  value: z.coerce.number().min(0).max(1000000),
});

const tenderSchema = z.object({
  method: z.enum(["CASH", "CARD", "ONLINE"]),
  amount: z.coerce.number().positive().max(1000000),
  tendered: z.coerce.number().min(0).max(1000000).optional(),
  cardLast4: z.string().trim().max(4).optional(),
  reference: z.string().trim().max(100).optional(),
});

const createSaleSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "Add at least one item").max(200),
  type: z.enum(["DINE_IN", "PICKUP"]).default("DINE_IN"),
  customerName: z.string().trim().max(120).optional().or(z.literal("")),
  discount: discountSchema.nullable().optional(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  tenders: z.array(tenderSchema).max(10).default([]),
});

export interface PosSaleResult {
  orderId: string;
  orderNumber: string;
  total: number;
  change: number;
  fullyPaid: boolean;
}

/** Create a walk-in sale and (optionally) settle it with one or more tenders. */
export async function createPosSale(input: unknown): Promise<ActionResult<PosSaleResult>> {
  const { restaurantId } = await requireTenant();
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const sale = await createWalkInSale(restaurantId, {
    items: data.items,
    type: data.type,
    customerName: data.customerName || null,
    discount: data.discount ?? null,
    note: data.note || null,
  });
  if (!sale.ok) return actionError(sale.error);

  let change = 0;
  let fullyPaid = false;
  if (data.tenders.length > 0) {
    // Route cash into the open drawer session if there is one.
    const hasCash = data.tenders.some((t) => t.method === "CASH");
    const drawer = hasCash ? await getOpenDrawer(restaurantId) : null;
    const pay = await recordPayments(
      restaurantId,
      sale.orderId,
      data.tenders as TenderInput[],
      drawer?.id ?? null
    );
    if (!pay.ok) return actionError(pay.error);
    change = pay.change;
    fullyPaid = pay.fullyPaid;
  }

  revalidatePath("/dashboard/pos");
  return actionOk({
    orderId: sale.orderId,
    orderNumber: sale.orderNumber,
    total: sale.total,
    change,
    fullyPaid,
  });
}

/** Resolve a scanned barcode / SKU to a product within the tenant. */
export async function lookupBarcode(code: unknown): Promise<ActionResult<{
  id: string;
  name: string;
  price: number;
}>> {
  const { restaurantId } = await requireTenant();
  const parsed = z.string().min(1).max(120).safeParse(code);
  if (!parsed.success) return actionError("Invalid code");

  const product = await findProductByCode(restaurantId, parsed.data);
  if (!product) return actionError("No product matches that code");
  return actionOk({ id: product.id, name: product.name, price: Number(product.price) });
}

const refundSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["CASH", "CARD"]),
  amount: z.coerce.number().positive().max(1000000).optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Refund a sale (full or partial); pays cash out of the open drawer when used. */
export async function refundPosSale(input: unknown): Promise<ActionResult<{ refunded: number }>> {
  const { restaurantId } = await requireTenant();
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const drawer = parsed.data.method === "CASH" ? await getOpenDrawer(restaurantId) : null;
  const res = await refundSale(
    restaurantId,
    parsed.data.orderId,
    { method: parsed.data.method, amount: parsed.data.amount, reason: parsed.data.reason },
    drawer?.id ?? null
  );
  if (!res.ok) return actionError(res.error);

  revalidatePath("/dashboard/pos");
  return actionOk({ refunded: res.refunded });
}

/** Open the cash drawer with a starting float. */
export async function openDrawerAction(openingFloat: unknown): Promise<ActionResult<{ sessionId: string }>> {
  const { restaurantId, userId } = await requireTenant();
  const parsed = z.coerce.number().min(0).max(1000000).safeParse(openingFloat);
  if (!parsed.success) return actionError("Invalid float");

  const res = await openDrawer(restaurantId, userId, parsed.data);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/pos");
  return actionOk({ sessionId: res.sessionId });
}

const closeSchema = z.object({
  sessionId: z.string().min(1),
  countedCash: z.coerce.number().min(0).max(1000000),
});

/** Close the cash drawer, recording the counted cash and variance. */
export async function closeDrawerAction(input: unknown): Promise<ActionResult<{ variance: number }>> {
  const { restaurantId } = await requireTenant();
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await closeDrawer(restaurantId, parsed.data.sessionId, parsed.data.countedCash);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/pos");
  return actionOk({ variance: res.variance });
}

const movementSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(["PAY_IN", "PAY_OUT"]),
  amount: z.coerce.number().positive().max(1000000),
  reason: z.string().trim().max(200).optional(),
});

/** Record a manual pay-in / pay-out against the open drawer. */
export async function drawerMovementAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await addDrawerMovement(
    restaurantId,
    parsed.data.sessionId,
    parsed.data.type,
    parsed.data.amount,
    parsed.data.reason
  );
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/pos");
  return actionOk();
}
