/**
 * End-to-end data test for the Customer Loyalty module.
 *
 * Exercises the pure tier/points/cashback maths plus the tenant-scoped engine:
 * order accrual (idempotent, tier-multiplied), points & cashback redemption into
 * single-use coupons, manual adjustments, VIP tier recomputation, birthday
 * bonuses (idempotent per year), program on/off, and cross-tenant isolation.
 *
 * Run: npx tsx scripts/test-loyalty.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  tierForPoints,
  pointsForOrder,
  cashbackForOrder,
  redeemValue,
  normaliseTiers,
  isSameMonthDay,
  tierProgress,
  DEFAULT_TIERS,
} from "../src/lib/loyalty/shared";
import {
  updateProgram,
  ensureProgram,
  accrueForOrder,
  redeemPoints,
  redeemPointsForCoupon,
  redeemCashback,
  adjustPoints,
  grantBirthdayReward,
  findBirthdayCustomers,
  listMembers,
} from "../src/lib/loyalty/engine";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

let seq = 0;
async function makeOrder(restaurantId: string, customerId: string, total: number) {
  seq++;
  return prisma.order.create({
    data: {
      restaurantId,
      customerId,
      orderNumber: `L${String(seq).padStart(4, "0")}`,
      total: new Prisma.Decimal(total),
    },
    select: { id: true },
  });
}

async function loadCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    select: { loyaltyPoints: true, lifetimePoints: true, cashbackBalance: true, vipTier: true, isMember: true },
  });
}

async function main() {
  const tag = `__loytest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "LA", ownerName: "A" } });
  const tenantB = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "LB", ownerName: "B" } });

  const cust = await prisma.customer.create({ data: { restaurantId: tenantA.id, phone: `0700${tag}`, name: "Loyal Larry" } });

  try {
    console.log("\n[1] Pure tier / points / cashback maths");
    check("0 → Bronze", tierForPoints(0).name === "Bronze");
    check("500 → Silver", tierForPoints(500).name === "Silver");
    check("4999 → Gold", tierForPoints(4999).name === "Gold");
    check("5000 → Platinum", tierForPoints(5000).name === "Platinum");
    check("pointsForOrder 50@1x1 = 50", pointsForOrder(50, 1, 1) === 50);
    check("pointsForOrder 100@1x1.5 = 150", pointsForOrder(100, 1, 1.5) === 150);
    check("pointsForOrder floors", pointsForOrder(10.5, 1, 1) === 10);
    check("pointsForOrder zero total = 0", pointsForOrder(0, 1, 1) === 0);
    check("cashback 100 @10% = 10", cashbackForOrder(100, 10) === 10);
    check("cashback off = 0", cashbackForOrder(100, 0) === 0);
    check("redeemValue 100 @0.01 = 1", redeemValue(100, 0.01) === 1);
    check("normaliseTiers junk → default", normaliseTiers("nope").length === DEFAULT_TIERS.length);
    check("tierProgress 600 → Silver, next Gold", (() => {
      const p = tierProgress(600);
      return p.current.name === "Silver" && p.next?.name === "Gold" && p.toNext === 1400;
    })());
    const today = new Date();
    check("isSameMonthDay matches", isSameMonthDay(new Date(1990, today.getMonth(), today.getDate()), today));

    console.log("\n[2] Program setup + order accrual + idempotency");
    await ensureProgram(tenantA.id);
    await updateProgram(tenantA.id, {
      isActive: true,
      pointsPerCurrency: 1,
      pointValue: 0.01,
      cashbackPercent: 10,
      birthdayBonusPoints: 200,
      minRedeemPoints: 100,
    });
    const order1 = await makeOrder(tenantA.id, cust.id, 100);
    const acc1 = await accrueForOrder(tenantA.id, order1.id);
    check("accrual 1: 100 pts + 10 cashback", acc1.ok && acc1.points === 100 && acc1.cashback === 10, acc1);
    let c = await loadCustomer(cust.id);
    check("balance 100, lifetime 100, cashback 10, enrolled", c?.loyaltyPoints === 100 && c?.lifetimePoints === 100 && Number(c?.cashbackBalance) === 10 && c?.isMember === true);
    const earnTxn = await prisma.loyaltyTransaction.findFirst({ where: { orderId: order1.id, type: "EARN" } });
    const cashTxn = await prisma.loyaltyTransaction.findFirst({ where: { orderId: order1.id, type: "CASHBACK" } });
    check("EARN + CASHBACK ledger rows", earnTxn?.points === 100 && Number(cashTxn?.amount) === 10);
    const acc1again = await accrueForOrder(tenantA.id, order1.id);
    check("re-accrual is idempotent", acc1again.ok && (acc1again as { alreadyAccrued?: boolean }).alreadyAccrued === true);
    c = await loadCustomer(cust.id);
    check("balance unchanged after re-accrual", c?.loyaltyPoints === 100);

    console.log("\n[3] VIP tier multiplier on earning");
    await adjustPoints(tenantA.id, cust.id, 500, "promo");
    c = await loadCustomer(cust.id);
    check("adjust +500 → Silver tier", c?.vipTier === "Silver" && c?.loyaltyPoints === 600 && c?.lifetimePoints === 600);
    const order2 = await makeOrder(tenantA.id, cust.id, 100);
    const acc2 = await accrueForOrder(tenantA.id, order2.id);
    check("Silver earns 1.25× = 125 pts", acc2.ok && acc2.points === 125, acc2);
    c = await loadCustomer(cust.id);
    check("balance 725, cashback 20", c?.loyaltyPoints === 725 && Number(c?.cashbackBalance) === 20);

    console.log("\n[4] Points redemption");
    check("below minimum rejected", !(await redeemPoints(tenantA.id, cust.id, 50)).ok);
    check("more than balance rejected", !(await redeemPoints(tenantA.id, cust.id, 100000)).ok);
    const r1 = await redeemPoints(tenantA.id, cust.id, 200);
    check("redeem 200 → value 2", r1.ok && (r1 as { value: number }).value === 2);
    c = await loadCustomer(cust.id);
    check("balance 525 after redeem", c?.loyaltyPoints === 525);
    const rc = await redeemPointsForCoupon(tenantA.id, cust.id, 100);
    check("redeem → coupon ok", rc.ok && (rc as { code: string }).code.startsWith("RW"));
    if (rc.ok) {
      const coupon = await prisma.coupon.findFirst({ where: { restaurantId: tenantA.id, code: rc.code } });
      check("coupon is FIXED, single-use, loyalty-sourced", coupon?.type === "FIXED" && Number(coupon?.value) === 1 && coupon?.usageLimit === 1 && coupon?.source === "LOYALTY" && coupon?.customerId === cust.id);
    }
    c = await loadCustomer(cust.id);
    check("balance 425 after coupon", c?.loyaltyPoints === 425);

    console.log("\n[5] Cashback redemption");
    const cb = await redeemCashback(tenantA.id, cust.id, 4);
    check("cashback → coupon CB", cb.ok && (cb as { code: string }).code.startsWith("CB"));
    c = await loadCustomer(cust.id);
    check("cashback balance 16", Number(c?.cashbackBalance) === 16);
    check("over-cashback rejected", !(await redeemCashback(tenantA.id, cust.id, 9999)).ok);

    console.log("\n[6] Manual adjustment guards");
    check("zero adjust rejected", !(await adjustPoints(tenantA.id, cust.id, 0)).ok);
    check("negative beyond balance rejected", !(await adjustPoints(tenantA.id, cust.id, -100000)).ok);
    check("negative adjust ok", (await adjustPoints(tenantA.id, cust.id, -25)).ok);
    c = await loadCustomer(cust.id);
    check("balance 400 after -25", c?.loyaltyPoints === 400);

    console.log("\n[7] Birthday offers");
    await prisma.customer.update({ where: { id: cust.id }, data: { birthday: new Date(1990, today.getMonth(), today.getDate()) } });
    const b1 = await grantBirthdayReward(tenantA.id, cust.id);
    check("birthday bonus 200 granted", b1.ok && (b1 as { points: number }).points === 200);
    check("birthday reward idempotent this year", !(await grantBirthdayReward(tenantA.id, cust.id)).ok);
    const noBday = await prisma.customer.create({ data: { restaurantId: tenantA.id, phone: `0701${tag}`, name: "No BDay" } });
    check("no birthday on file rejected", !(await grantBirthdayReward(tenantA.id, noBday.id)).ok);
    const notToday = await prisma.customer.create({ data: { restaurantId: tenantA.id, phone: `0702${tag}`, name: "Other Day", birthday: new Date(1990, (today.getMonth() + 1) % 12, 1) } });
    const wrongDay = await grantBirthdayReward(tenantA.id, notToday.id);
    // Guard against the rare case where month+1/day-1 collides with today.
    check("non-birthday rejected", !wrongDay.ok || (today.getMonth() + 1) % 12 === today.getMonth());
    const bdayList = await findBirthdayCustomers(tenantA.id, today);
    check("birthday list includes today's customer", bdayList.some((x) => x.id === cust.id));

    console.log("\n[8] Program disabled → no accrual");
    await updateProgram(tenantA.id, { isActive: false });
    const order3 = await makeOrder(tenantA.id, cust.id, 50);
    const acc3 = await accrueForOrder(tenantA.id, order3.id);
    check("inactive program skips accrual", acc3.ok && (acc3 as { skipped?: boolean }).skipped === true && acc3.points === 0);
    await updateProgram(tenantA.id, { isActive: true });

    console.log("\n[9] Tenant isolation");
    check("B cannot accrue A's order", !(await accrueForOrder(tenantB.id, order2.id)).ok);
    check("B cannot redeem A's customer", !(await redeemPoints(tenantB.id, cust.id, 100)).ok);
    check("B cannot adjust A's customer", !(await adjustPoints(tenantB.id, cust.id, 100)).ok);
    check("B cannot redeem A's cashback", !(await redeemCashback(tenantB.id, cust.id, 1)).ok);
    check("B cannot grant A's birthday", !(await grantBirthdayReward(tenantB.id, cust.id)).ok);
    check("B birthday list excludes A's customer", (await findBirthdayCustomers(tenantB.id, today)).every((x) => x.id !== cust.id));
    check("B member list excludes A's customer", (await listMembers(tenantB.id)).every((x) => x.id !== cust.id));
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
