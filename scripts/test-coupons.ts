/**
 * End-to-end test for the Coupons module. Tests validation, duplicate code,
 * evaluateCoupon rules (active/dates/usage/min order/percentage/fixed),
 * checkout redemption (server-authoritative + usedCount increment), and tenant
 * isolation.
 *
 * Run: npx tsx scripts/test-coupons.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createCouponSchema } from "../src/lib/validations/coupon";
import { evaluateCoupon } from "../src/lib/coupons/evaluate";
import { placeOrderPublic, validateCouponPublic } from "../src/app/r/[slug]/actions";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

async function main() {
  const tag = `cp${Date.now().toString(36)}`;
  const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "A", ownerName: "A", taxRate: new Prisma.Decimal(0) } });
  const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "B", ownerName: "B" } });
  const product = await prisma.product.create({ data: { restaurantId: a.id, name: "Dish", slug: "dish", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(20), discount: new Prisma.Decimal(0) } });

  try {
    console.log("\n[1] Validation");
    check("rejects short code", !createCouponSchema.safeParse({ code: "ab", type: "PERCENTAGE", value: 10 }).success);
    check("rejects percentage > 100", !createCouponSchema.safeParse({ code: "BIG", type: "PERCENTAGE", value: 150 }).success);
    check("rejects value <= 0", !createCouponSchema.safeParse({ code: "ZERO", type: "FIXED", value: 0 }).success);
    check("rejects end before start", !createCouponSchema.safeParse({ code: "BAD", type: "FIXED", value: 5, startsAt: "2026-12-31", endsAt: "2026-01-01" }).success);
    check("accepts valid", createCouponSchema.safeParse({ code: "WELCOME10", type: "PERCENTAGE", value: 10 }).success);

    console.log("\n[2] Coupon setup + duplicate code");
    const pct = await prisma.coupon.create({ data: { restaurantId: a.id, code: "SAVE10", type: "PERCENTAGE", value: new Prisma.Decimal(10), minimumOrder: new Prisma.Decimal(0), isActive: true } });
    const fixed = await prisma.coupon.create({ data: { restaurantId: a.id, code: "MINUS5", type: "FIXED", value: new Prisma.Decimal(5), minimumOrder: new Prisma.Decimal(30), isActive: true } });
    const dupe = await prisma.coupon.findFirst({ where: { restaurantId: a.id, code: "SAVE10" } });
    check("duplicate-code check finds existing", dupe?.id === pct.id);

    console.log("\n[3] evaluateCoupon rules");
    const e1 = await evaluateCoupon(a.id, "save10", 50); // case-insensitive, 10% of 50 = 5
    check("percentage discount computed (case-insensitive)", e1.ok && e1.discount === 5, e1);
    const e2 = await evaluateCoupon(a.id, "MINUS5", 50); // fixed 5
    check("fixed discount computed", e2.ok && e2.discount === 5, e2);
    const e3 = await evaluateCoupon(a.id, "MINUS5", 20); // below min order 30
    check("min order enforced", !e3.ok);
    const e4 = await evaluateCoupon(a.id, "NOPE", 50);
    check("invalid code rejected", !e4.ok);
    // expired
    await prisma.coupon.create({ data: { restaurantId: a.id, code: "OLD", type: "FIXED", value: new Prisma.Decimal(5), endsAt: new Date(Date.now() - 86_400_000), isActive: true } });
    const e5 = await evaluateCoupon(a.id, "OLD", 50);
    check("expired coupon rejected", !e5.ok);
    // inactive
    await prisma.coupon.create({ data: { restaurantId: a.id, code: "OFF", type: "FIXED", value: new Prisma.Decimal(5), isActive: false } });
    const e6 = await evaluateCoupon(a.id, "OFF", 50);
    check("inactive coupon rejected", !e6.ok);
    // fixed cannot exceed subtotal
    const e7 = await evaluateCoupon(a.id, "MINUS5", 3); // min order 30 blocks; make a big fixed without min
    await prisma.coupon.create({ data: { restaurantId: a.id, code: "HUGE", type: "FIXED", value: new Prisma.Decimal(999), isActive: true } });
    const e8 = await evaluateCoupon(a.id, "HUGE", 10);
    check("fixed discount capped at subtotal", e8.ok && e8.discount === 10, e8);
    void e7;

    console.log("\n[4] Usage limit + checkout redemption (atomic increment)");
    const limited = await prisma.coupon.create({ data: { restaurantId: a.id, code: "ONCE", type: "PERCENTAGE", value: new Prisma.Decimal(50), usageLimit: 1, usedCount: 0, isActive: true } });
    // Order subtotal 20, 50% off = 10 discount, total 10.
    const order1 = await placeOrderPublic(`${tag}-a`, { customerName: "X", customerPhone: "0700", type: "PICKUP", couponCode: "ONCE", items: [{ productId: product.id, quantity: 1, extras: [] }] });
    check("checkout applies coupon", order1.ok, order1);
    if (order1.ok) {
      const o = await prisma.order.findFirst({ where: { restaurantId: a.id, orderNumber: order1.data!.orderNumber } });
      check("order discount = 10, total = 10, code snapshot stored", Number(o?.discountAmount) === 10 && Number(o?.total) === 10 && o?.couponCode === "ONCE");
    }
    const after = await prisma.coupon.findUnique({ where: { id: limited.id } });
    check("usedCount incremented to 1", after?.usedCount === 1);
    // Second use should hit the limit.
    const order2 = await placeOrderPublic(`${tag}-a`, { customerName: "Y", customerPhone: "0701", type: "PICKUP", couponCode: "ONCE", items: [{ productId: product.id, quantity: 1, extras: [] }] });
    check("usage limit enforced at checkout", !order2.ok);
    const preview = await validateCouponPublic(`${tag}-a`, "SAVE10", 100);
    check("public preview returns discount (10)", preview.ok && preview.data!.discount === 10, preview);

    console.log("\n[5] Tenant isolation");
    const crossEval = await evaluateCoupon(b.id, "SAVE10", 50); // tenant A's coupon
    check("tenant B cannot use tenant A coupon", !crossEval.ok);
    const crossCheckout = await placeOrderPublic(`${tag}-b`, { customerName: "Z", customerPhone: "0702", type: "PICKUP", couponCode: "SAVE10", items: [] });
    check("tenant B checkout cannot use tenant A coupon", !crossCheckout.ok);
    const bCoupons = await prisma.coupon.count({ where: { restaurantId: b.id } });
    check("tenant B has no coupons", bCoupons === 0);
    const crossDelete = await prisma.coupon.deleteMany({ where: { id: pct.id, restaurantId: b.id } });
    check("tenant B cannot delete tenant A coupon", crossDelete.count === 0);
    void fixed;
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
