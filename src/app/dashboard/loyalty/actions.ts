"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/staff/permissions";
import {
  updateProgram,
  adjustPoints,
  redeemPointsForCoupon,
  redeemCashback,
  grantBirthdayReward,
} from "@/lib/loyalty/engine";

async function ensureManager() {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "customers:manage")) return { restaurantId, allowed: false as const };
  return { restaurantId, allowed: true as const };
}

const programSchema = z.object({
  isActive: z.boolean().optional(),
  pointsPerCurrency: z.coerce.number().min(0).max(1000).optional(),
  pointValue: z.coerce.number().min(0).max(1000).optional(),
  minRedeemPoints: z.coerce.number().int().min(0).max(1000000).optional(),
  cashbackPercent: z.coerce.number().min(0).max(100).optional(),
  birthdayBonusPoints: z.coerce.number().int().min(0).max(1000000).optional(),
});

/** Save the loyalty program settings. Requires `customers:manage`. */
export async function saveLoyaltyProgram(input: unknown): Promise<ActionResult> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return actionError("Please provide valid settings");

  await updateProgram(restaurantId, parsed.data);
  revalidatePath("/dashboard/loyalty");
  return actionOk();
}

const adjustSchema = z.object({
  customerId: z.string().min(1),
  points: z.coerce.number().int(),
  note: z.string().trim().max(200).optional(),
});

/** Manually adjust a customer's points. Requires `customers:manage`. */
export async function adjustCustomerPoints(input: unknown): Promise<ActionResult<{ balance: number }>> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await adjustPoints(restaurantId, parsed.data.customerId, parsed.data.points, parsed.data.note);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/loyalty");
  return actionOk({ balance: res.balance });
}

const redeemSchema = z.object({
  customerId: z.string().min(1),
  points: z.coerce.number().int().positive(),
});

/** Redeem a customer's points into a single-use coupon. Requires `customers:manage`. */
export async function redeemCustomerPoints(input: unknown): Promise<ActionResult<{ code: string; value: number }>> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await redeemPointsForCoupon(restaurantId, parsed.data.customerId, parsed.data.points);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/loyalty");
  return actionOk({ code: res.code, value: res.value });
}

const cashbackSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number().positive(),
});

/** Redeem a customer's cashback into a single-use coupon. Requires `customers:manage`. */
export async function redeemCustomerCashback(input: unknown): Promise<ActionResult<{ code: string; value: number }>> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = cashbackSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await redeemCashback(restaurantId, parsed.data.customerId, parsed.data.amount);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/loyalty");
  return actionOk({ code: res.code, value: res.value });
}

/** Grant today's birthday bonus to a customer. Requires `customers:manage`. */
export async function grantBirthday(input: unknown): Promise<ActionResult<{ points: number }>> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = z.object({ customerId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await grantBirthdayReward(restaurantId, parsed.data.customerId);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/loyalty");
  return actionOk({ points: res.points });
}

const birthdaySchema = z.object({
  customerId: z.string().min(1),
  birthday: z.coerce.date(),
});

/** Set/update a customer's birthday. Requires `customers:manage`. */
export async function setCustomerBirthday(input: unknown): Promise<ActionResult> {
  const { restaurantId, allowed } = await ensureManager();
  if (!allowed) return actionError("You don't have permission to manage loyalty");

  const parsed = birthdaySchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid date");

  const res = await prisma.customer.updateMany({
    where: { id: parsed.data.customerId, restaurantId },
    data: { birthday: parsed.data.birthday },
  });
  if (res.count === 0) return actionError("Customer not found");
  revalidatePath("/dashboard/loyalty");
  return actionOk();
}
