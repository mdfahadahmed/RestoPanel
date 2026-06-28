"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { createCouponSchema, updateCouponSchema } from "@/lib/validations/coupon";

function toDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return d;
}

async function codeClash(restaurantId: string, code: string, excludeId?: string) {
  const existing = await prisma.coupon.findFirst({
    where: { restaurantId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function createCoupon(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createCouponSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  const code = d.code.toUpperCase();

  if (await codeClash(restaurantId, code)) {
    return actionError("Please fix the errors below", { code: ["A coupon with this code already exists"] });
  }

  try {
    const created = await prisma.coupon.create({
      data: {
        restaurantId,
        code,
        type: d.type,
        value: new Prisma.Decimal(d.value),
        minimumOrder: new Prisma.Decimal(d.minimumOrder),
        usageLimit: d.usageLimit ?? null,
        startsAt: toDate(d.startsAt),
        endsAt: toDate(d.endsAt, true),
        isActive: d.isActive,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/coupons");
    return actionOk({ id: created.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return actionError("Please fix the errors below", { code: ["A coupon with this code already exists"] });
    }
    throw e;
  }
}

export async function updateCoupon(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  const code = d.code.toUpperCase();

  const existing = await prisma.coupon.findFirst({ where: { id: d.id, restaurantId }, select: { id: true } });
  if (!existing) return actionError("Coupon not found");

  if (await codeClash(restaurantId, code, d.id)) {
    return actionError("Please fix the errors below", { code: ["A coupon with this code already exists"] });
  }

  await prisma.coupon.update({
    where: { id: existing.id },
    data: {
      code,
      type: d.type,
      value: new Prisma.Decimal(d.value),
      minimumOrder: new Prisma.Decimal(d.minimumOrder),
      usageLimit: d.usageLimit ?? null,
      startsAt: toDate(d.startsAt),
      endsAt: toDate(d.endsAt, true),
      isActive: d.isActive,
    },
  });
  revalidatePath("/dashboard/coupons");
  return actionOk();
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.coupon.updateMany({ where: { id, restaurantId }, data: { isActive } });
  if (res.count === 0) return actionError("Coupon not found");
  revalidatePath("/dashboard/coupons");
  return actionOk();
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.coupon.deleteMany({ where: { id, restaurantId } });
  if (res.count === 0) return actionError("Coupon not found");
  revalidatePath("/dashboard/coupons");
  return actionOk();
}
