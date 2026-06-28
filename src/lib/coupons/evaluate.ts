import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type CouponEvaluation =
  | { ok: true; code: string; discount: number; couponId: string }
  | { ok: false; error: string };

/**
 * Validate a coupon for a restaurant against an order subtotal and compute the
 * discount — shared by the storefront preview action and the checkout so the
 * rules (active, date window, usage limit, minimum order) are enforced
 * server-side in one place. Tenant-scoped by restaurantId.
 */
export async function evaluateCoupon(
  restaurantId: string,
  rawCode: string,
  subtotal: number
): Promise<CouponEvaluation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code" };

  const coupon = await prisma.coupon.findFirst({ where: { restaurantId, code } });
  if (!coupon) return { ok: false, error: "Invalid coupon code" };
  if (!coupon.isActive) return { ok: false, error: "This coupon is no longer active" };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, error: "This coupon isn't active yet" };
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, error: "This coupon has expired" };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit" };
  }
  if (subtotal < Number(coupon.minimumOrder)) {
    return { ok: false, error: `Minimum order for this coupon is ${Number(coupon.minimumOrder).toFixed(2)}` };
  }

  const value = Number(coupon.value);
  const raw = coupon.type === "PERCENTAGE" ? (subtotal * value) / 100 : value;
  const discount = round2(Math.min(raw, subtotal)); // never exceed the subtotal

  return { ok: true, code: coupon.code, discount, couponId: coupon.id };
}
