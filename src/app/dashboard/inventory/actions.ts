"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { stockStatusEnum } from "@/lib/validations/product";

const updateStockSchema = z.object({
  id: z.string().min(1),
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  stockStatus: stockStatusEnum,
});

/** Update a single product's stock quantity + status (tenant-scoped). */
export async function updateStock(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateStockSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid stock values");
  const { id, stockQuantity, stockStatus } = parsed.data;

  const res = await prisma.product.updateMany({
    where: { id, restaurantId, deletedAt: null },
    data: { stockQuantity, stockStatus },
  });
  if (res.count === 0) return actionError("Product not found");

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  return actionOk();
}
