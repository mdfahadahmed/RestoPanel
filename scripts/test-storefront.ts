/**
 * End-to-end test for the Customer Ordering Website (storefront).
 *
 * Calls the REAL public server actions (placeOrderPublic, createReservationPublic)
 * — which take only a public slug, no session — against the live database, plus
 * the tenant-scoped data queries the pages use. Verifies checkout totals
 * (server-authoritative pricing + tax + delivery), validation, order-type gating,
 * reservation, and cross-tenant isolation. Cleans up everything it creates.
 *
 * Run: npx tsx scripts/test-storefront.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { placeOrderPublic, createReservationPublic } from "../src/app/r/[slug]/actions";

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

async function main() {
  const tag = `__stest_${Date.now()}`;
  const slugA = `${tag}-a`;
  const slugB = `${tag}-b`;

  const tenantA = await prisma.restaurant.create({
    data: {
      slug: slugA,
      name: "Storefront A",
      ownerName: "A",
      taxRate: new Prisma.Decimal(10),
      deliveryFee: new Prisma.Decimal(5),
      deliveryEnabled: true,
      pickupEnabled: true,
      dineInEnabled: false, // for the gating test
      address: "1 Test St",
    },
  });
  const tenantB = await prisma.restaurant.create({ data: { slug: slugB, name: "Storefront B", ownerName: "B" } });

  const pizza = await prisma.product.create({
    data: {
      restaurantId: tenantA.id,
      name: "Pizza",
      slug: "pizza",
      status: "ACTIVE",
      isAvailable: true,
      price: new Prisma.Decimal(10),
      discount: new Prisma.Decimal(0),
      variants: [{ name: "Large", priceAdjustment: 2, stock: null, sku: "" }] as unknown as Prisma.InputJsonValue,
      extras: [
        { name: "Cheese", price: 1, isActive: true },
        { name: "Bacon", price: 2, isActive: false },
      ] as unknown as Prisma.InputJsonValue,
    },
  });
  const hidden = await prisma.product.create({
    data: { restaurantId: tenantA.id, name: "Hidden", slug: "hidden", status: "DRAFT", isAvailable: false, price: new Prisma.Decimal(8), discount: new Prisma.Decimal(0) },
  });

  try {
    console.log("\n[1] Slug → tenant resolution & menu scoping");
    const a = await prisma.restaurant.findUnique({ where: { slug: slugA } });
    check("restaurant resolves by slug", a?.id === tenantA.id);
    const missing = await prisma.restaurant.findUnique({ where: { slug: "nope-nope" } });
    check("unknown slug resolves to null", missing === null);
    const menuA = await prisma.product.findMany({ where: { restaurantId: tenantA.id, status: "ACTIVE", isAvailable: true, deletedAt: null } });
    check("menu lists only available active products", menuA.length === 1 && menuA[0].id === pizza.id);
    const menuB = await prisma.product.findMany({ where: { restaurantId: tenantB.id } });
    check("tenant B menu is empty", menuB.length === 0);

    console.log("\n[2] Checkout — server-authoritative pricing + tax + delivery");
    const res = await placeOrderPublic(slugA, {
      customerName: "Web Customer",
      customerPhone: "07999000111",
      type: "DELIVERY",
      address: "5 Some Road",
      paymentMethod: "CASH",
      items: [
        { productId: pizza.id, quantity: 2, variant: { name: "Large", priceAdjustment: 2 }, extras: [{ name: "Cheese", price: 1 }, { name: "Bacon", price: 2 }] },
        { productId: pizza.id, quantity: 1, variant: { name: "Ghost", priceAdjustment: 999 }, extras: [] },
      ],
    });
    check("checkout succeeded", res.ok, res);
    let orderNumber = "";
    if (res.ok) {
      orderNumber = res.data!.orderNumber;
      const order = await prisma.order.findFirst({ where: { restaurantId: tenantA.id, orderNumber }, include: { items: true, events: true } });
      check("order persisted", !!order);
      check("subtotal ignores fake variant + inactive extra (36)", Number(order?.subtotal) === 36);
      check("tax = 10% of subtotal (3.6)", Number(order?.taxAmount) === 3.6);
      check("delivery fee from settings (5)", Number(order?.deliveryFee) === 5);
      check("grand total = 44.6", Number(order?.total) === 44.6);
      check("payment is UNPAID online order", order?.paymentStatus === "UNPAID");
      check("initial timeline event PENDING", order?.events.length === 1 && order?.events[0].status === "PENDING");
      check("customer upserted + linked", order?.customerId != null);
    }

    console.log("\n[3] Checkout validation + gating");
    const noAddr = await placeOrderPublic(slugA, { customerName: "X", customerPhone: "0700", type: "DELIVERY", items: [{ productId: pizza.id, quantity: 1, extras: [] }] });
    check("delivery without address rejected", !noAddr.ok && !!(noAddr as { fieldErrors?: Record<string, unknown> }).fieldErrors?.address);
    const pickup = await placeOrderPublic(slugA, { customerName: "Y", customerPhone: "0700111", type: "PICKUP", items: [{ productId: pizza.id, quantity: 1, extras: [] }] });
    check("pickup order has no delivery fee", pickup.ok);
    if (pickup.ok) {
      const o = await prisma.order.findFirst({ where: { restaurantId: tenantA.id, orderNumber: pickup.data!.orderNumber } });
      check("pickup deliveryFee = 0, tax still applied", Number(o?.deliveryFee) === 0 && Number(o?.taxAmount) === 1);
    }
    const dineIn = await placeOrderPublic(slugA, { customerName: "Z", customerPhone: "0700222", type: "DINE_IN", items: [{ productId: pizza.id, quantity: 1, extras: [] }] });
    check("disabled order type (dine-in) rejected", !dineIn.ok);
    const unavailable = await placeOrderPublic(slugA, { customerName: "U", customerPhone: "0700333", type: "PICKUP", items: [{ productId: hidden.id, quantity: 1, extras: [] }] });
    check("ordering unavailable product rejected", !unavailable.ok);
    const empty = await placeOrderPublic(slugA, { customerName: "E", customerPhone: "0700444", type: "PICKUP", items: [] });
    check("empty cart rejected", !empty.ok);

    console.log("\n[4] Tenant isolation at checkout");
    const cross = await placeOrderPublic(slugB, { customerName: "Hacker", customerPhone: "0700555", type: "PICKUP", items: [{ productId: pizza.id, quantity: 1, extras: [] }] });
    check("cannot order tenant A product via tenant B site", !cross.ok);
    const bOrders = await prisma.order.count({ where: { restaurantId: tenantB.id } });
    check("tenant B received no orders", bOrders === 0);
    const unknown = await placeOrderPublic("nope-nope", { customerName: "N", customerPhone: "0700666", type: "PICKUP", items: [{ productId: pizza.id, quantity: 1, extras: [] }] });
    check("unknown slug checkout rejected", !unknown.ok);

    console.log("\n[5] Order tracking lookup");
    const tracked = await prisma.order.findFirst({ where: { restaurantId: tenantA.id, orderNumber }, include: { events: true } });
    check("order is trackable by slug + number", !!tracked && tracked.events.length >= 1);

    console.log("\n[6] Reservation");
    const future = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const okRes = await createReservationPublic(slugA, { name: "Diner", phone: "0700777", date: future, time: "19:30", partySize: 4, notes: "Window seat" });
    check("reservation created", okRes.ok, okRes);
    const reservation = await prisma.reservation.findFirst({ where: { restaurantId: tenantA.id } });
    check("reservation persisted PENDING", reservation?.status === "PENDING" && reservation?.partySize === 4);
    const past = await createReservationPublic(slugA, { name: "Late", phone: "0700888", date: "2000-01-01", time: "12:00", partySize: 2 });
    check("past reservation rejected", !past.ok);
    const crossRes = await createReservationPublic("nope-nope", { name: "X", phone: "0700999", date: future, time: "12:00", partySize: 2 });
    check("reservation for unknown slug rejected", !crossRes.ok);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
