/**
 * End-to-end data test for the Point of Sale (POS) module.
 *
 * Exercises the pure POS helpers (discount, change, split bill, drawer maths)
 * plus the tenant-scoped Prisma logic behind the server actions: walk-in sales
 * with server-authoritative pricing + tax, barcode/SKU lookup, split/cash/card
 * payments with change, full + partial refunds, and the cash-drawer lifecycle
 * (open → movements → close → variance) — including cross-tenant isolation.
 *
 * Run: npx tsx scripts/test-pos.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  applyDiscount,
  computeChange,
  sumTenders,
  splitEqually,
  expectedDrawerCash,
  drawerVariance,
} from "../src/lib/pos/shared";
import {
  createWalkInSale,
  findProductByCode,
  recordPayments,
  refundSale,
  netPaid,
} from "../src/lib/pos/sale";
import {
  openDrawer,
  closeDrawer,
  addDrawerMovement,
  getDrawerSummary,
} from "../src/lib/pos/drawer";

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

const approx = (a: number, b: number) => Math.abs(a - b) < 0.005;

async function main() {
  const tag = `__postest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({
    data: { slug: `${tag}-a`, name: "PA", ownerName: "A", taxRate: new Prisma.Decimal(0) },
  });
  const tenantB = await prisma.restaurant.create({
    data: { slug: `${tag}-b`, name: "PB", ownerName: "B", taxRate: new Prisma.Decimal(20) },
  });

  const productA = await prisma.product.create({
    data: {
      restaurantId: tenantA.id,
      name: "Latte",
      slug: "latte",
      price: new Prisma.Decimal(10),
      discount: new Prisma.Decimal(0),
      barcode: "BAR123",
      sku: "SKU9",
    },
  });
  const productB = await prisma.product.create({
    data: { restaurantId: tenantB.id, name: "Mocha", slug: "mocha", price: new Prisma.Decimal(10) },
  });

  try {
    console.log("\n[1] Pure helpers — discount, change, split");
    check("percent discount", applyDiscount(100, { kind: "PERCENT", value: 10 }) === 10);
    check("amount discount", applyDiscount(100, { kind: "AMOUNT", value: 5 }) === 5);
    check("discount cannot exceed subtotal", applyDiscount(20, { kind: "AMOUNT", value: 999 }) === 20);
    check("percent clamped to 100", applyDiscount(50, { kind: "PERCENT", value: 999 }) === 50);
    check("no discount → 0", applyDiscount(50, null) === 0);
    check("change owed", computeChange(20, 13) === 7);
    check("change never negative", computeChange(10, 13) === 0);
    check("sum tenders", sumTenders([{ amount: 10 }, { amount: 5.5 }]) === 15.5);
    const s3 = splitEqually(100, 3);
    check("split into 3 sums to total", approx(s3.reduce((a, b) => a + b, 0), 100) && s3.length === 3);
    const s4 = splitEqually(10, 4);
    check("split into 4 sums to total", approx(s4.reduce((a, b) => a + b, 0), 10) && s4.length === 4);

    console.log("\n[2] Pure helpers — drawer maths");
    check(
      "expected cash ignores OPENING, sums signed movements",
      expectedDrawerCash(100, [
        { type: "OPENING", amount: 100 },
        { type: "SALE", amount: 20 },
        { type: "REFUND", amount: -5 },
        { type: "PAY_IN", amount: 10 },
        { type: "PAY_OUT", amount: -15 },
      ]) === 110
    );
    check("variance over", drawerVariance(110, 100) === 10);
    check("variance short", drawerVariance(95, 100) === -5);

    console.log("\n[3] Walk-in sale — server-authoritative pricing + discount");
    const sale1 = await createWalkInSale(tenantA.id, {
      items: [{ productId: productA.id, quantity: 2, extras: [] }],
      type: "DINE_IN",
      discount: { kind: "AMOUNT", value: 5 },
    });
    check("sale created", sale1.ok, sale1);
    if (sale1.ok) {
      const o = await prisma.order.findUnique({ where: { id: sale1.orderId }, include: { items: true } });
      check("order is CONFIRMED + UNPAID", o?.status === "CONFIRMED" && o?.paymentStatus === "UNPAID");
      check("subtotal = 20", Number(o?.subtotal) === 20);
      check("discount = 5", Number(o?.discountAmount) === 5);
      check("tax = 0 (taxRate 0)", Number(o?.taxAmount) === 0);
      check("total = 15", Number(o?.total) === 15 && sale1.total === 15);
      check("one line item, qty 2", o?.items.length === 1 && o?.items[0].quantity === 2);
    }

    console.log("\n[4] Tax applied from restaurant taxRate");
    const saleTax = await createWalkInSale(tenantB.id, {
      items: [{ productId: productB.id, quantity: 2, extras: [] }],
    });
    check("tax sale created", saleTax.ok, saleTax);
    if (saleTax.ok) {
      const o = await prisma.order.findUnique({ where: { id: saleTax.orderId } });
      check("tax = 20% of 20 = 4", Number(o?.taxAmount) === 4);
      check("total = 24", Number(o?.total) === 24);
    }

    console.log("\n[5] Barcode / SKU lookup");
    const byBarcode = await findProductByCode(tenantA.id, "BAR123");
    check("found by barcode", byBarcode?.id === productA.id);
    const bySku = await findProductByCode(tenantA.id, "SKU9");
    check("found by SKU", bySku?.id === productA.id);
    check("unknown code → null", (await findProductByCode(tenantA.id, "ZZZ")) === null);
    check("tenant B cannot find tenant A barcode", (await findProductByCode(tenantB.id, "BAR123")) === null);

    console.log("\n[6] Payments — cash with change, marks PAID");
    if (sale1.ok) {
      const pay = await recordPayments(tenantA.id, sale1.orderId, [
        { method: "CASH", amount: 15, tendered: 20 },
      ]);
      check("cash payment ok", pay.ok && approx((pay as { change: number }).change, 5));
      check("fully paid", pay.ok && pay.fullyPaid === true);
      const o = await prisma.order.findUnique({ where: { id: sale1.orderId } });
      check("order now PAID", o?.paymentStatus === "PAID");
      check("netPaid = 15", (await netPaid(tenantA.id, sale1.orderId)) === 15);
    }

    console.log("\n[7] Split bill — card + cash");
    const sale2 = await createWalkInSale(tenantA.id, {
      items: [{ productId: productA.id, quantity: 2, extras: [] }],
    });
    if (sale2.ok) {
      const pay = await recordPayments(tenantA.id, sale2.orderId, [
        { method: "CARD", amount: 12, cardLast4: "4242" },
        { method: "CASH", amount: 8, tendered: 8 },
      ]);
      check("split payment fully paid", pay.ok && pay.fullyPaid === true);
      const payments = await prisma.payment.findMany({ where: { orderId: sale2.orderId } });
      check("two payment rows recorded", payments.length === 2);
      check("card last4 stored", payments.some((p) => p.cardLast4 === "4242"));
      const o = await prisma.order.findUnique({ where: { id: sale2.orderId } });
      check("paymentMethod = last tender (CASH)", o?.paymentMethod === "CASH" && o?.paymentStatus === "PAID");
    }

    console.log("\n[8] Underpayment + invalid tenders");
    const sale3 = await createWalkInSale(tenantA.id, {
      items: [{ productId: productA.id, quantity: 2, extras: [] }],
    });
    if (sale3.ok) {
      const under = await recordPayments(tenantA.id, sale3.orderId, [{ method: "CARD", amount: 5 }]);
      check("underpayment not fully paid", under.ok && under.fullyPaid === false);
      const o = await prisma.order.findUnique({ where: { id: sale3.orderId } });
      check("order stays UNPAID", o?.paymentStatus === "UNPAID");
      check("empty tenders rejected", !(await recordPayments(tenantA.id, sale3.orderId, [])).ok);
      check("negative tender rejected", !(await recordPayments(tenantA.id, sale3.orderId, [{ method: "CASH", amount: -5 }])).ok);
    }

    console.log("\n[9] Refunds — full (card) + partial (cash)");
    const sale4 = await createWalkInSale(tenantA.id, {
      items: [{ productId: productA.id, quantity: 1, extras: [] }],
    });
    if (sale4.ok) {
      await recordPayments(tenantA.id, sale4.orderId, [{ method: "CARD", amount: 10, cardLast4: "1111" }]);
      const refund = await refundSale(tenantA.id, sale4.orderId, { method: "CARD" });
      check("full card refund", refund.ok && (refund as { refunded: number }).refunded === 10);
      const o = await prisma.order.findUnique({ where: { id: sale4.orderId } });
      check("order paymentStatus REFUNDED", o?.paymentStatus === "REFUNDED");
      check("netPaid back to 0", (await netPaid(tenantA.id, sale4.orderId)) === 0);
    }
    const sale5 = await createWalkInSale(tenantA.id, {
      items: [{ productId: productA.id, quantity: 2, extras: [] }],
    });
    if (sale5.ok) {
      await recordPayments(tenantA.id, sale5.orderId, [{ method: "CASH", amount: 20, tendered: 20 }]);
      const partial = await refundSale(tenantA.id, sale5.orderId, { method: "CASH", amount: 5 });
      check("partial refund of 5", partial.ok && (partial as { refunded: number }).refunded === 5);
      check("netPaid = 15 after partial refund", (await netPaid(tenantA.id, sale5.orderId)) === 15);
      // An over-sized refund is clamped to the remaining net paid (15), not rejected.
      const over = await refundSale(tenantA.id, sale5.orderId, { method: "CASH", amount: 9999 });
      check("over-refund clamped to remaining", over.ok && (over as { refunded: number }).refunded === 15);
      check("netPaid = 0 after clamped refund", (await netPaid(tenantA.id, sale5.orderId)) === 0);
    }

    console.log("\n[10] Cash drawer lifecycle + variance");
    const open1 = await openDrawer(tenantA.id, null, 50);
    check("drawer opened", open1.ok, open1);
    check("cannot open a second drawer", !(await openDrawer(tenantA.id, null, 10)).ok);
    if (open1.ok) {
      const sid = open1.sessionId;
      // D1: cash sale → SALE +10
      const d1 = await createWalkInSale(tenantA.id, { items: [{ productId: productA.id, quantity: 1, extras: [] }] });
      if (d1.ok) await recordPayments(tenantA.id, d1.orderId, [{ method: "CASH", amount: 10, tendered: 10 }], sid);
      // D2: card sale → no drawer effect
      const d2 = await createWalkInSale(tenantA.id, { items: [{ productId: productA.id, quantity: 1, extras: [] }] });
      if (d2.ok) await recordPayments(tenantA.id, d2.orderId, [{ method: "CARD", amount: 10 }], sid);
      // D3: cash sale +10 then cash refund -10
      const d3 = await createWalkInSale(tenantA.id, { items: [{ productId: productA.id, quantity: 1, extras: [] }] });
      if (d3.ok) {
        await recordPayments(tenantA.id, d3.orderId, [{ method: "CASH", amount: 10, tendered: 10 }], sid);
        await refundSale(tenantA.id, d3.orderId, { method: "CASH" }, sid);
      }
      await addDrawerMovement(tenantA.id, sid, "PAY_IN", 25, "float top-up");
      await addDrawerMovement(tenantA.id, sid, "PAY_OUT", 5, "supplier");

      const summary = await getDrawerSummary(tenantA.id, sid);
      check("expected cash = 80 (50 +10 +10 -10 +25 -5)", summary?.expected === 80, summary?.expected);

      const close = await closeDrawer(tenantA.id, sid, 78);
      check("close computes variance -2", close.ok && (close as { variance: number }).variance === -2);
      const closed = await prisma.drawerSession.findUnique({ where: { id: sid } });
      check("session CLOSED with counted + variance", closed?.status === "CLOSED" && Number(closed?.variance) === -2);
      check("can open a new drawer after close", (await openDrawer(tenantA.id, null, 30)).ok);
    }

    console.log("\n[11] Tenant isolation");
    const crossSale = await createWalkInSale(tenantB.id, {
      items: [{ productId: productA.id, quantity: 1, extras: [] }],
    });
    check("tenant B cannot sell tenant A product", !crossSale.ok);
    if (sale2.ok) {
      check("tenant B cannot pay tenant A order", !(await recordPayments(tenantB.id, sale2.orderId, [{ method: "CASH", amount: 1 }])).ok);
      check("tenant B cannot refund tenant A order", !(await refundSale(tenantB.id, sale2.orderId, { method: "CASH" })).ok);
    }
    if (open1.ok) {
      check("tenant B cannot see tenant A drawer", (await getDrawerSummary(tenantB.id, open1.sessionId)) === null);
      check("tenant B cannot close tenant A drawer", !(await closeDrawer(tenantB.id, open1.sessionId, 0)).ok);
    }
    void productB;
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
