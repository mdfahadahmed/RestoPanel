import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/validations/order";
import {
  DEFAULT_TIERS,
  normaliseTiers,
  tierForPoints,
  pointsForOrder,
  cashbackForOrder,
  redeemValue,
  isSameMonthDay,
} from "@/lib/loyalty/shared";

export * from "@/lib/loyalty/shared";

/** Get the tenant's loyalty program, creating it with defaults on first use. */
export async function ensureProgram(restaurantId: string) {
  const existing = await prisma.loyaltyProgram.findUnique({ where: { restaurantId } });
  if (existing) return existing;
  return prisma.loyaltyProgram.create({
    data: { restaurantId, tiers: DEFAULT_TIERS as unknown as Prisma.InputJsonValue },
  });
}

export interface ProgramPatch {
  isActive?: boolean;
  pointsPerCurrency?: number;
  pointValue?: number;
  minRedeemPoints?: number;
  cashbackPercent?: number;
  birthdayBonusPoints?: number;
}

/** Update the loyalty program settings (tenant-scoped). */
export async function updateProgram(restaurantId: string, patch: ProgramPatch) {
  await ensureProgram(restaurantId);
  const data: Record<string, unknown> = {};
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.pointsPerCurrency !== undefined)
    data.pointsPerCurrency = new Prisma.Decimal(Math.max(0, patch.pointsPerCurrency));
  if (patch.pointValue !== undefined) data.pointValue = new Prisma.Decimal(Math.max(0, patch.pointValue));
  if (patch.minRedeemPoints !== undefined) data.minRedeemPoints = Math.max(0, Math.floor(patch.minRedeemPoints));
  if (patch.cashbackPercent !== undefined)
    data.cashbackPercent = new Prisma.Decimal(Math.min(100, Math.max(0, patch.cashbackPercent)));
  if (patch.birthdayBonusPoints !== undefined)
    data.birthdayBonusPoints = Math.max(0, Math.floor(patch.birthdayBonusPoints));
  await prisma.loyaltyProgram.update({ where: { restaurantId }, data });
  return { ok: true as const };
}

async function uniqueCouponCode(restaurantId: string, prefix: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const exists = await prisma.coupon.findFirst({ where: { restaurantId, code }, select: { id: true } });
    if (!exists) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

export type AccrualResult =
  | { ok: true; points: number; cashback: number; tier?: string; alreadyAccrued?: boolean; skipped?: boolean }
  | { ok: false; error: string };

/**
 * Award reward points + cashback for a completed order. Idempotent per order
 * (guarded by a pre-check and the unique [orderId, EARN] constraint), so it's
 * safe to call from the order-completion hook. Recomputes the customer's VIP
 * tier and auto-enrols them in the loyalty program.
 */
export async function accrueForOrder(restaurantId: string, orderId: string): Promise<AccrualResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { id: true, customerId: true, total: true },
  });
  if (!order) return { ok: false, error: "Order not found" };
  if (!order.customerId) return { ok: false, error: "Order has no customer" };

  const existing = await prisma.loyaltyTransaction.findFirst({
    where: { orderId, type: "EARN" },
    select: { id: true },
  });
  if (existing) return { ok: true, points: 0, cashback: 0, alreadyAccrued: true };

  const program = await ensureProgram(restaurantId);
  if (!program.isActive) return { ok: true, points: 0, cashback: 0, skipped: true };

  const customer = await prisma.customer.findFirst({
    where: { id: order.customerId, restaurantId },
    select: { id: true, lifetimePoints: true, isMember: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };

  const tiers = normaliseTiers(program.tiers);
  const tier = tierForPoints(customer.lifetimePoints, tiers);
  const total = Number(order.total);
  const points = pointsForOrder(total, Number(program.pointsPerCurrency), tier.multiplier);
  const cashback = cashbackForOrder(total, Number(program.cashbackPercent));
  const newTier = tierForPoints(customer.lifetimePoints + points, tiers).name;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: { restaurantId, customerId: customer.id, type: "EARN", points, orderId, note: "Order reward" },
      });
      if (cashback > 0) {
        await tx.loyaltyTransaction.create({
          data: { restaurantId, customerId: customer.id, type: "CASHBACK", amount: new Prisma.Decimal(cashback), orderId },
        });
      }
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: { increment: points },
          lifetimePoints: { increment: points },
          cashbackBalance: { increment: new Prisma.Decimal(cashback) },
          vipTier: newTier,
          ...(customer.isMember ? {} : { isMember: true, memberSince: new Date() }),
        },
      });
    });
  } catch (e) {
    // Unique [orderId, EARN] violation = a concurrent accrual already ran.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: true, points: 0, cashback: 0, alreadyAccrued: true };
    }
    throw e;
  }

  return { ok: true, points, cashback, tier: newTier };
}

export type RedeemResult = { ok: true; points: number; value: number } | { ok: false; error: string };

/** Redeem points for store value (deducts the balance; records a REDEEM entry). */
export async function redeemPoints(
  restaurantId: string,
  customerId: string,
  points: number
): Promise<RedeemResult> {
  const program = await ensureProgram(restaurantId);
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { loyaltyPoints: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };
  if (!(points > 0)) return { ok: false, error: "Points must be positive" };
  if (points < program.minRedeemPoints) {
    return { ok: false, error: `Minimum redemption is ${program.minRedeemPoints} points` };
  }
  if (points > customer.loyaltyPoints) return { ok: false, error: "Not enough points" };

  const value = redeemValue(points, Number(program.pointValue));
  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { decrement: points } } }),
    prisma.loyaltyTransaction.create({
      data: { restaurantId, customerId, type: "REDEEM", points: -points, note: `Redeemed for ${value}` },
    }),
  ]);
  return { ok: true, points, value };
}

export type CouponRedeemResult = { ok: true; code: string; value: number } | { ok: false; error: string };

/** Redeem points into a single-use fixed-amount coupon the customer can spend. */
export async function redeemPointsForCoupon(
  restaurantId: string,
  customerId: string,
  points: number
): Promise<CouponRedeemResult> {
  const program = await ensureProgram(restaurantId);
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { loyaltyPoints: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };
  if (!(points > 0)) return { ok: false, error: "Points must be positive" };
  if (points < program.minRedeemPoints) {
    return { ok: false, error: `Minimum redemption is ${program.minRedeemPoints} points` };
  }
  if (points > customer.loyaltyPoints) return { ok: false, error: "Not enough points" };

  const value = redeemValue(points, Number(program.pointValue));
  const code = await uniqueCouponCode(restaurantId, "RW");
  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { decrement: points } } }),
    prisma.loyaltyTransaction.create({
      data: { restaurantId, customerId, type: "REDEEM", points: -points, note: `Coupon ${code}` },
    }),
    prisma.coupon.create({
      data: {
        restaurantId,
        code,
        type: "FIXED",
        value: new Prisma.Decimal(value),
        minimumOrder: new Prisma.Decimal(0),
        usageLimit: 1,
        isActive: true,
        customerId,
        source: "LOYALTY",
      },
    }),
  ]);
  return { ok: true, code, value };
}

/** Redeem cashback (store credit) into a single-use fixed-amount coupon. */
export async function redeemCashback(
  restaurantId: string,
  customerId: string,
  amount: number
): Promise<CouponRedeemResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { cashbackBalance: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };

  const value = round2(amount);
  if (!(value > 0)) return { ok: false, error: "Amount must be positive" };
  if (value > Number(customer.cashbackBalance)) return { ok: false, error: "Not enough cashback" };

  const code = await uniqueCouponCode(restaurantId, "CB");
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { cashbackBalance: { decrement: new Prisma.Decimal(value) } },
    }),
    prisma.loyaltyTransaction.create({
      data: { restaurantId, customerId, type: "CASHBACK_REDEEM", amount: new Prisma.Decimal(-value), note: `Coupon ${code}` },
    }),
    prisma.coupon.create({
      data: {
        restaurantId,
        code,
        type: "FIXED",
        value: new Prisma.Decimal(value),
        minimumOrder: new Prisma.Decimal(0),
        usageLimit: 1,
        isActive: true,
        customerId,
        source: "CASHBACK",
      },
    }),
  ]);
  return { ok: true, code, value };
}

export type AdjustResult = { ok: true; balance: number } | { ok: false; error: string };

/** Manually adjust a customer's points (positive or negative). */
export async function adjustPoints(
  restaurantId: string,
  customerId: string,
  points: number,
  note?: string
): Promise<AdjustResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { loyaltyPoints: true, lifetimePoints: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };
  if (!Number.isInteger(points) || points === 0) return { ok: false, error: "Enter a non-zero whole number" };

  const newBalance = customer.loyaltyPoints + points;
  if (newBalance < 0) return { ok: false, error: "Adjustment would make the balance negative" };

  const tiers = normaliseTiers((await ensureProgram(restaurantId)).tiers);
  const newLifetime = points > 0 ? customer.lifetimePoints + points : customer.lifetimePoints;
  const newTier = tierForPoints(newLifetime, tiers).name;

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: { increment: points },
        ...(points > 0 ? { lifetimePoints: { increment: points }, vipTier: newTier } : {}),
      },
    }),
    prisma.loyaltyTransaction.create({
      data: { restaurantId, customerId, type: "ADJUST", points, note: note || null },
    }),
  ]);
  return { ok: true, balance: newBalance };
}

export type BirthdayResult = { ok: true; points: number } | { ok: false; error: string };

/**
 * Grant a birthday bonus if it's the customer's birthday today and they haven't
 * already received one this calendar year.
 */
export async function grantBirthdayReward(restaurantId: string, customerId: string): Promise<BirthdayResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { birthday: true, lifetimePoints: true, isMember: true },
  });
  if (!customer) return { ok: false, error: "Customer not found" };
  if (!customer.birthday) return { ok: false, error: "No birthday on file" };

  const today = new Date();
  if (!isSameMonthDay(customer.birthday, today)) return { ok: false, error: "It isn't their birthday today" };

  const program = await ensureProgram(restaurantId);
  const bonus = program.birthdayBonusPoints;
  if (bonus <= 0) return { ok: false, error: "No birthday bonus is configured" };

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const already = await prisma.loyaltyTransaction.findFirst({
    where: { restaurantId, customerId, type: "BIRTHDAY", createdAt: { gte: yearStart } },
    select: { id: true },
  });
  if (already) return { ok: false, error: "Birthday reward already granted this year" };

  const tiers = normaliseTiers(program.tiers);
  const newTier = tierForPoints(customer.lifetimePoints + bonus, tiers).name;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: { restaurantId, customerId, type: "BIRTHDAY", points: bonus, note: "Birthday bonus" },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: { increment: bonus },
        lifetimePoints: { increment: bonus },
        vipTier: newTier,
        ...(customer.isMember ? {} : { isMember: true, memberSince: new Date() }),
      },
    }),
  ]);
  return { ok: true, points: bonus };
}

/** Customers whose birthday falls on `date` (default today), tenant-scoped. */
export async function findBirthdayCustomers(restaurantId: string, date: Date = new Date()) {
  const customers = await prisma.customer.findMany({
    where: { restaurantId, birthday: { not: null } },
    select: { id: true, name: true, phone: true, birthday: true, vipTier: true },
  });
  return customers.filter((c) => c.birthday && isSameMonthDay(c.birthday, date));
}

/** Customers enrolled in loyalty, richest first — for the members table. */
export async function listMembers(restaurantId: string, take = 100) {
  return prisma.customer.findMany({
    where: { restaurantId, isMember: true },
    orderBy: { lifetimePoints: "desc" },
    take,
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      lifetimePoints: true,
      cashbackBalance: true,
      vipTier: true,
      birthday: true,
      memberSince: true,
    },
  });
}
