"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { getKitchenBoard, setKitchenPriority, type KdsBoard } from "@/lib/kds/board";
import { updateOrderStatus } from "@/app/dashboard/orders/actions";
import { orderStatusEnum } from "@/lib/validations/order";

/** Fetch the current kitchen board for the signed-in tenant (client polls this). */
export async function fetchKitchenBoard(): Promise<ActionResult<KdsBoard>> {
  const { restaurantId } = await requireTenant();
  const board = await getKitchenBoard(restaurantId);
  return actionOk(board);
}

const advanceSchema = z.object({
  id: z.string().min(1),
  status: orderStatusEnum,
});

/**
 * Advance an order to the next kitchen status. Delegates to the shared
 * `updateOrderStatus` action so the state-machine guard, the OrderEvent
 * timeline, and customer notifications all stay consistent.
 */
export async function advanceKitchenOrder(input: unknown): Promise<ActionResult> {
  const parsed = advanceSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await updateOrderStatus(parsed.data);
  if (res.ok) revalidatePath("/dashboard/kitchen");
  return res;
}

const prioritySchema = z.object({
  id: z.string().min(1),
  value: z.boolean(),
});

/** Star/un-star an order as a kitchen rush (pins it to the top of its column). */
export async function toggleKitchenPriority(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = prioritySchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await setKitchenPriority(restaurantId, parsed.data.id, parsed.data.value);
  if (!res.ok) return actionError("Order not found");

  revalidatePath("/dashboard/kitchen");
  return actionOk();
}
