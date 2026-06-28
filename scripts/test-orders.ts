/**
 * End-to-end data test for the Orders module.
 *
 * Exercises the real Zod schemas + status workflow + the exact tenant-scoped
 * Prisma logic the server actions use (order build, totals, status transitions,
 * payment, search/filter/sort/pagination) — including cross-tenant isolation —
 * against the live database, then cleans up everything it created.
 *
 * Run: npx tsx scripts/test-orders.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createOrderSchema,
  canTransition,
  computeTotals,
  unitPriceFor,
  round2,
  STATUS_TRANSITIONS,
  type OrderItemInput,
} from "../src/lib/validations/order";

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

// Mirror of the server action's item builder (server-authoritative pricing).
async function buildItems(restaurantId: string, items: OrderItemInput[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: ids }, deletedAt: null },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const built = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) return null;
    const discount = Number(product.discount);
    const base = discount > 0 ? round2(Number(product.price) * (1 - discount / 100)) : round2(Number(product.price));
    const pv = (product.variants as unknown as { name: string; priceAdjustment: number }[]) ?? [];
    let variant: { name: string; priceAdjustment: number } | null = null;
    if (item.variant) {
      const m = pv.find((v) => v.name === item.variant!.name);
      if (m) variant = { name: m.name, priceAdjustment: Number(m.priceAdjustment) || 0 };
    }
    const pe = (product.extras as unknown as { name: string; price: number; isActive?: boolean }[]) ?? [];
    const extras: { name: string; price: number }[] = [];
    for (const ex of item.extras) {
      const m = pe.find((e) => e.name === ex.name && e.isActive !== false);
      if (m) extras.push({ name: m.name, price: Number(m.price) || 0 });
    }
    const unitPrice = unitPriceFor(base, variant, extras);
    built.push({
      productId: product.id,
      nameSnapshot: product.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: round2(unitPrice * item.quantity),
      options: { variant, extras },
    });
  }
  const subtotal = round2(built.reduce((s, b) => s + b.lineTotal, 0));
  return { built, subtotal };
}

async function nextOrderNumber(restaurantId: string) {
  const count = await prisma.order.count({ where: { restaurantId } });
  for (let i = 1; i <= 25; i++) {
    const candidate = String(count + i).padStart(4, "0");
    const exists = await prisma.order.findFirst({ where: { restaurantId, orderNumber: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return String(Date.now());
}

async function createOrder(restaurantId: string, input: unknown) {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };
  const data = parsed.data;
  const ir = await buildItems(restaurantId, data.items);
  if (!ir) return { ok: false as const, error: "products not found" };
  const totals = computeTotals(ir.subtotal, data.discountAmount, data.taxAmount, data.type === "DELIVERY" ? data.deliveryFee : 0);

  let customerId: string | null = null;
  if (data.customerPhone) {
    const c = await prisma.customer.upsert({
      where: { restaurantId_phone: { restaurantId, phone: data.customerPhone } },
      update: { name: data.customerName || undefined },
      create: { restaurantId, phone: data.customerPhone, name: data.customerName || null },
    });
    customerId = c.id;
  }

  const orderNumber = await nextOrderNumber(restaurantId);
  const order = await prisma.order.create({
    data: {
      restaurantId,
      customerId,
      orderNumber,
      type: data.type,
      status: "PENDING",
      customerName: data.customerName || null,
      customerPhone: data.customerPhone || null,
      address: data.address || null,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      subtotal: new Prisma.Decimal(totals.subtotal),
      discountAmount: new Prisma.Decimal(totals.discountAmount),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      deliveryFee: new Prisma.Decimal(totals.deliveryFee),
      total: new Prisma.Decimal(totals.total),
      notes: data.notes || null,
      items: {
        create: ir.built.map((b) => ({
          productId: b.productId,
          nameSnapshot: b.nameSnapshot,
          unitPrice: new Prisma.Decimal(b.unitPrice),
          quantity: b.quantity,
          lineTotal: new Prisma.Decimal(b.lineTotal),
          options: b.options as unknown as Prisma.InputJsonValue,
        })),
      },
      events: { create: { status: "PENDING", note: "Order created" } },
    },
    include: { items: true, events: true },
  });
  return { ok: true as const, order };
}

async function updateStatus(restaurantId: string, id: string, status: Prisma.OrderUpdateInput["status"] & string) {
  const order = await prisma.order.findFirst({ where: { id, restaurantId }, select: { id: true, status: true } });
  if (!order) return { ok: false as const, error: "not found" };
  if (!canTransition(order.status, status as never)) return { ok: false as const, error: "invalid transition" };
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: status as never, ...(status === "REFUNDED" ? { paymentStatus: "REFUNDED" } : {}) },
    }),
    prisma.orderEvent.create({ data: { orderId: order.id, status: status as never } }),
  ]);
  return { ok: true as const };
}

async function main() {
  const tag = `__otest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "OA", ownerName: "A" } });
  const tenantB = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "OB", ownerName: "B" } });

  // Product for tenant A with a variant + active/inactive extras.
  const productA = await prisma.product.create({
    data: {
      restaurantId: tenantA.id,
      name: "Burger",
      slug: "burger",
      price: new Prisma.Decimal(10),
      discount: new Prisma.Decimal(0),
      variants: [{ name: "Large", priceAdjustment: 2, stock: null, sku: "" }] as unknown as Prisma.InputJsonValue,
      extras: [
        { name: "Cheese", price: 1, isActive: true },
        { name: "Bacon", price: 2, isActive: false },
      ] as unknown as Prisma.InputJsonValue,
    },
  });
  // Tenant B product (for isolation test).
  const productB = await prisma.product.create({
    data: { restaurantId: tenantB.id, name: "Fries", slug: "fries", price: new Prisma.Decimal(3), discount: new Prisma.Decimal(0) },
  });

  try {
    console.log("\n[1] Validation + workflow rules");
    check("rejects order with no items", !createOrderSchema.safeParse({ customerName: "Joe", items: [] }).success);
    check(
      "delivery requires address",
      !createOrderSchema.safeParse({ customerName: "Joe", type: "DELIVERY", items: [{ productId: "x", quantity: 1 }] }).success
    );
    check(
      "requires customer name or id",
      !createOrderSchema.safeParse({ type: "PICKUP", items: [{ productId: "x", quantity: 1 }] }).success
    );
    check("PENDING→CONFIRMED allowed", canTransition("PENDING", "CONFIRMED"));
    check("PENDING→DELIVERED blocked", !canTransition("PENDING", "DELIVERED"));
    check("DELIVERED→REFUNDED allowed", canTransition("DELIVERED", "REFUNDED"));
    check("REFUNDED is terminal", STATUS_TRANSITIONS.REFUNDED.length === 0);

    console.log("\n[2] computeTotals");
    const t = computeTotals(100, 10, 5, 3);
    check("total = subtotal - discount + tax + delivery", t.total === 98);
    check("discount cannot exceed subtotal", computeTotals(20, 999, 0, 0).discountAmount === 20);
    check("never negative", computeTotals(5, 999, 0, 0).total === 0);

    console.log("\n[3] Create order (server-authoritative pricing)");
    const created = await createOrder(tenantA.id, {
      customerName: "Alice",
      customerPhone: "07000000001",
      type: "PICKUP",
      paymentMethod: "CASH",
      paymentStatus: "UNPAID",
      items: [
        // Large (+2) + Cheese (+1) → unit 13, qty 2 → 26
        { productId: productA.id, quantity: 2, variant: { name: "Large", priceAdjustment: 2 }, extras: [{ name: "Cheese", price: 1 }] },
        // tampered prices + inactive extra Bacon should be ignored → unit 10, qty 1 → 10
        { productId: productA.id, quantity: 1, variant: { name: "Ghost", priceAdjustment: 999 }, extras: [{ name: "Bacon", price: 2 }] },
      ],
      discountAmount: 6,
      taxAmount: 0,
      deliveryFee: 5, // ignored for PICKUP
    });
    check("order created", created.ok, "ok" in created ? undefined : created);
    if (created.ok) {
      const o = created.order;
      check("server ignored fake variant + inactive extra", Number(o.subtotal) === 36);
      check("delivery fee ignored for pickup", Number(o.deliveryFee) === 0);
      check("grand total = 36 - 6", Number(o.total) === 30);
      check("two line items", o.items.length === 2);
      check("initial timeline event", o.events.length === 1 && o.events[0].status === "PENDING");
      check("customer upserted + linked", o.customerId !== null);
      check("order number assigned", !!o.orderNumber);

      console.log("\n[4] Status workflow transitions");
      const bad = await updateStatus(tenantA.id, o.id, "DELIVERED");
      check("illegal transition rejected", !bad.ok);
      const ok1 = await updateStatus(tenantA.id, o.id, "CONFIRMED");
      const ok2 = await updateStatus(tenantA.id, o.id, "PREPARING");
      check("legal transitions applied", ok1.ok && ok2.ok);
      const afterEvents = await prisma.orderEvent.count({ where: { orderId: o.id } });
      check("events appended to timeline", afterEvents === 3);

      console.log("\n[5] Payment + refund");
      await prisma.order.updateMany({ where: { id: o.id, restaurantId: tenantA.id }, data: { paymentStatus: "PAID" } });
      const paid = await prisma.order.findFirst({ where: { id: o.id, restaurantId: tenantA.id }, select: { paymentStatus: true } });
      check("marked paid", paid?.paymentStatus === "PAID");
      // READY then DELIVERED then REFUNDED
      await updateStatus(tenantA.id, o.id, "READY");
      await updateStatus(tenantA.id, o.id, "DELIVERED");
      const refunded = await updateStatus(tenantA.id, o.id, "REFUNDED");
      const refState = await prisma.order.findFirst({ where: { id: o.id }, select: { status: true, paymentStatus: true } });
      check("refund sets status + payment", refunded.ok && refState?.status === "REFUNDED" && refState?.paymentStatus === "REFUNDED");
    }

    console.log("\n[6] Search / filter / sort / pagination");
    for (let i = 0; i < 5; i++) {
      await createOrder(tenantA.id, {
        customerName: `Bob ${i}`,
        customerPhone: `0711100000${i}`,
        type: "PICKUP",
        paymentMethod: i % 2 ? "CARD" : "CASH",
        paymentStatus: i % 2 ? "PAID" : "UNPAID",
        items: [{ productId: productA.id, quantity: i + 1, extras: [] }],
      });
    }
    const byNumber = await prisma.order.findMany({ where: { restaurantId: tenantA.id, orderNumber: { contains: "0001" } } });
    check("search by order number", byNumber.length === 1);
    const byCustomer = await prisma.order.findMany({
      where: { restaurantId: tenantA.id, customerName: { contains: "bob", mode: "insensitive" } },
    });
    check("search by customer name", byCustomer.length === 5);
    const paidCard = await prisma.order.count({ where: { restaurantId: tenantA.id, paymentMethod: "CARD", paymentStatus: "PAID" } });
    check("filter payment method + status", paidCard >= 2);
    const sorted = await prisma.order.findMany({ where: { restaurantId: tenantA.id }, orderBy: { total: "desc" }, take: 2 });
    check("sort by total desc", Number(sorted[0].total) >= Number(sorted[1].total));
    const total = await prisma.order.count({ where: { restaurantId: tenantA.id } });
    const pageSize = 3;
    const p1 = await prisma.order.findMany({ where: { restaurantId: tenantA.id }, orderBy: { createdAt: "desc" }, take: pageSize, skip: 0 });
    const p2 = await prisma.order.findMany({ where: { restaurantId: tenantA.id }, orderBy: { createdAt: "desc" }, take: pageSize, skip: pageSize });
    check("pagination distinct pages", p1.length === 3 && !p1.some((a) => p2.find((b) => b.id === a.id)) && total === 6);

    console.log("\n[7] Stats aggregation");
    const grouped = await prisma.order.groupBy({ by: ["status"], where: { restaurantId: tenantA.id }, _count: { _all: true } });
    const sum = grouped.reduce((s, g) => s + g._count._all, 0);
    check("status groupby sums to total", sum === total);
    const revenue = await prisma.order.aggregate({ where: { restaurantId: tenantA.id, paymentStatus: "PAID" }, _sum: { total: true } });
    check("revenue aggregate computed", Number(revenue._sum.total ?? 0) > 0);

    console.log("\n[8] Tenant isolation");
    const aFromB = await prisma.order.findFirst({ where: { restaurantId: tenantB.id, customerName: { contains: "Alice" } } });
    check("tenant B cannot see tenant A orders", aFromB === null);
    const crossStatus = await updateStatus(tenantB.id, byNumber[0].id, "CANCELLED");
    check("tenant B cannot transition tenant A order", !crossStatus.ok);
    // Order referencing tenant A product cannot be built under tenant B.
    const crossBuild = await buildItems(tenantB.id, [{ productId: productA.id, quantity: 1, extras: [] }]);
    check("tenant B cannot use tenant A product", crossBuild === null);
    const bOrders = await prisma.order.count({ where: { restaurantId: tenantB.id } });
    check("tenant B has zero orders", bOrders === 0);
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
