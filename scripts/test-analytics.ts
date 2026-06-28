/**
 * End-to-end test for the Analytics module. Seeds known orders/items and
 * verifies getAnalytics() computes revenue, AOV, returning customers, best
 * sellers and category sales correctly, scoped per tenant.
 *
 * Run: npx tsx scripts/test-analytics.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { getAnalytics } from "../src/app/dashboard/analytics/data";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

async function main() {
  const tag = `an${Date.now().toString(36)}`;
  const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "A", ownerName: "A" } });
  const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "B", ownerName: "B" } });

  const cat = await prisma.category.create({ data: { restaurantId: a.id, name: "Pizza", slug: "pizza" } });
  const p1 = await prisma.product.create({ data: { restaurantId: a.id, categoryId: cat.id, name: "Margherita", slug: "marg", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(10), discount: new Prisma.Decimal(0) } });
  const p2 = await prisma.product.create({ data: { restaurantId: a.id, categoryId: cat.id, name: "Pepperoni", slug: "pep", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(12), discount: new Prisma.Decimal(0) } });

  const cust = await prisma.customer.create({ data: { restaurantId: a.id, phone: "0700", name: "Repeat" } });

  // Helper to create an order with items.
  async function order(opts: { num: string; paid: boolean; customerId?: string; items: { product: { id: string; name: string }; qty: number; unit: number }[] }) {
    const subtotal = opts.items.reduce((s, i) => s + i.unit * i.qty, 0);
    await prisma.order.create({
      data: {
        restaurantId: a.id, orderNumber: opts.num, status: "DELIVERED",
        paymentStatus: opts.paid ? "PAID" : "UNPAID", paymentMethod: "CASH",
        customerId: opts.customerId ?? null,
        subtotal: new Prisma.Decimal(subtotal), total: new Prisma.Decimal(subtotal),
        items: { create: opts.items.map((i) => ({ productId: i.product.id, nameSnapshot: i.product.name, unitPrice: new Prisma.Decimal(i.unit), quantity: i.qty, lineTotal: new Prisma.Decimal(i.unit * i.qty) })) },
      },
    });
  }

  // Two PAID orders by the same customer (returning), one UNPAID.
  await order({ num: "A1", paid: true, customerId: cust.id, items: [{ product: p1, qty: 3, unit: 10 }] }); // 30, 3x Margherita
  await order({ num: "A2", paid: true, customerId: cust.id, items: [{ product: p2, qty: 1, unit: 12 }] }); // 12, 1x Pepperoni
  await order({ num: "A3", paid: false, customerId: cust.id, items: [{ product: p1, qty: 1, unit: 10 }] }); // unpaid 10

  // Tenant B order (must never leak into A's analytics).
  const bp = await prisma.product.create({ data: { restaurantId: b.id, name: "BFood", slug: "bfood", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(99), discount: new Prisma.Decimal(0) } });
  await prisma.order.create({ data: { restaurantId: b.id, orderNumber: "B1", status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "CASH", subtotal: new Prisma.Decimal(99), total: new Prisma.Decimal(99), items: { create: [{ productId: bp.id, nameSnapshot: "BFood", unitPrice: new Prisma.Decimal(99), quantity: 1, lineTotal: new Prisma.Decimal(99) }] } } });

  try {
    const from = new Date(Date.now() - 2 * 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    const d = await getAnalytics(a.id, from, to);

    console.log("\n[1] Cards");
    check("revenue counts only PAID (30+12=42)", d.revenue === 42, d.revenue);
    check("orders counts all (3)", d.orders === 3, d.orders);
    check("AOV = revenue / paid orders (21)", d.avgOrderValue === 21, d.avgOrderValue);
    check("returning customers (1)", d.returningCustomers === 1, d.returningCustomers);
    check("new customers in range (1)", d.newCustomers === 1, d.newCustomers);

    console.log("\n[2] Best sellers + category sales");
    check("best seller is Margherita (qty 4)", d.bestSellers[0]?.name === "Margherita" && d.bestSellers[0]?.quantity === 4, d.bestSellers);
    const pizzaCat = d.categorySales.find((c) => c.name === "Pizza");
    check("category sales aggregates all items (52)", pizzaCat?.revenue === 52, d.categorySales);

    console.log("\n[3] Series");
    check("daily series present", Array.isArray(d.daily) && d.daily.length >= 1);
    check("monthly has 6 buckets", d.monthly.length === 6);
    check("weekly has 8 buckets", d.weekly.length === 8);

    console.log("\n[4] Tenant isolation");
    check("tenant A revenue excludes B's £99", d.revenue === 42);
    const bAnalytics = await getAnalytics(b.id, from, to);
    check("tenant B sees only its own revenue (99)", bAnalytics.revenue === 99, bAnalytics.revenue);
    check("tenant B best seller is BFood", bAnalytics.bestSellers[0]?.name === "BFood");
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
