"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { replyReviewSchema, toggleReviewSchema } from "@/lib/validations/review";

export async function replyToReview(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = replyReviewSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const reply = parsed.data.reply?.trim() || null;
  const res = await prisma.review.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { reply, repliedAt: reply ? new Date() : null },
  });
  if (res.count === 0) return actionError("Review not found");

  revalidatePath("/dashboard/reviews");
  return actionOk();
}

export async function toggleReviewVisibility(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = toggleReviewSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await prisma.review.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { isPublished: parsed.data.isPublished },
  });
  if (res.count === 0) return actionError("Review not found");

  revalidatePath("/dashboard/reviews");
  return actionOk();
}

export async function deleteReview(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.review.deleteMany({ where: { id, restaurantId } });
  if (res.count === 0) return actionError("Review not found");

  revalidatePath("/dashboard/reviews");
  return actionOk();
}
