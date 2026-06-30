/**
 * End-to-end data test for the Kitchen Display System (KDS).
 *
 * Exercises the pure board helpers (column mapping, prep estimate, urgency,
 * ticket ordering) plus the exact tenant-scoped Prisma logic the KDS server
 * actions use (getKitchenBoard grouping/sort/serialization, setKitchenPriority)
 * — including cross-tenant isolation — against the live database, then cleans up
 * everything it created.
 *
 * Run: npx tsx scripts/test-kds.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { canTransition, type OrderStatus } from "../src/lib/validations/order";
import {
  KDS_BOARD_STATUSES,
  DEFAULT_PREP_MINS,
  kdsColumnForStatus,
  estimatePrepMins,
  urgencyLevel,
  compareTickets,
  type KdsTicket,
} from "../src/lib/kds/shared";
import { getKitchenBoard, setKitchenPriority } from "../src/lib/kds/board";

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
interface MakeOrderOpts {
  status: OrderStatus;
  type?: "DELIVERY" | "PICKUP" | "DINE_IN";
  kitchenPriority?: boolean;
  createdAt?: Date;
  productId?: string | null;
  itemName?: string;
  quantity?: number;
  customerName?: string;
  events?: { status: OrderStatus; createdAt?: Date }[];
}

async function makeOrder(restaurantId: string, opts: MakeOrderOpts) {
  seq++;
  return prisma.order.create({
    data: {
      restaurantId,
      orderNumber: String(seq).padStart(4, "0"),
      status: opts.status,
      type: opts.type ?? "PICKUP",
      total: new Prisma.Decimal(10),
      kitchenPriority: opts.kitchenPriority ?? false,
      customerName: opts.customerName ?? "Test",
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      items: {
        create: [
          {
            productId: opts.productId ?? null,
            nameSnapshot: opts.itemName ?? "Burger",
            unitPrice: new Prisma.Decimal(10),
            quantity: opts.quantity ?? 1,
            lineTotal: new Prisma.Decimal(10),
          },
        ],
      },
      events: {
        create: (opts.events ?? [{ status: opts.status }]).map((e) => ({
          status: e.status,
          ...(e.createdAt ? { createdAt: e.createdAt } : {}),
        })),
      },
    },
    select: { id: true, orderNumber: true },
  });
}

/** Build a minimal ticket for pure-function tests. */
function fakeTicket(over: Partial<KdsTicket>): KdsTicket {
  return {
    id: "x",
    orderNumber: "0001",
    type: "PICKUP",
    status: "CONFIRMED",
    customerName: null,
    total: 0,
    kitchenPriority: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    statusSince: "2026-01-01T00:00:00.000Z",
    targetPrepMins: 15,
    items: [],
    ...over,
  };
}

async function main() {
  const tag = `__kdstest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({
    data: { slug: `${tag}-a`, name: "KA", ownerName: "A" },
  });
  const tenantB = await prisma.restaurant.create({
    data: { slug: `${tag}-b`, name: "KB", ownerName: "B" },
  });

  // Product with a known prep time so targetPrepMins is deterministic.
  const productA = await prisma.product.create({
    data: {
      restaurantId: tenantA.id,
      name: "Slow Burger",
      slug: "slow-burger",
      price: new Prisma.Decimal(10),
      discount: new Prisma.Decimal(0),
      prepTimeMins: 20,
    },
  });

  try {
    console.log("\n[1] Pure helpers — column mapping");
    check("PENDING → new", kdsColumnForStatus("PENDING") === "new");
    check("CONFIRMED → new", kdsColumnForStatus("CONFIRMED") === "new");
    check("PREPARING → preparing", kdsColumnForStatus("PREPARING") === "preparing");
    check("READY → ready", kdsColumnForStatus("READY") === "ready");
    check("OUT_FOR_DELIVERY excluded", kdsColumnForStatus("OUT_FOR_DELIVERY") === null);
    check("DELIVERED excluded", kdsColumnForStatus("DELIVERED") === null);
    check("CANCELLED excluded", kdsColumnForStatus("CANCELLED") === null);
    check("REJECTED excluded", kdsColumnForStatus("REJECTED") === null);
    check("REFUNDED excluded", kdsColumnForStatus("REFUNDED") === null);
    check("board statuses are the four kitchen states", KDS_BOARD_STATUSES.length === 4);

    console.log("\n[2] Pure helpers — prep estimate + urgency");
    check("max declared prep wins", estimatePrepMins([{ prepTimeMins: 10 }, { prepTimeMins: 25 }]) === 25);
    check("null prep → default", estimatePrepMins([{ prepTimeMins: null }]) === DEFAULT_PREP_MINS);
    check("empty items → default", estimatePrepMins([]) === DEFAULT_PREP_MINS);
    check("under target → ok", urgencyLevel(5, 20) === "ok");
    check("at target → warn", urgencyLevel(20, 20) === "warn");
    check("over target → warn", urgencyLevel(25, 20) === "warn");
    check("at 1.5× target → late", urgencyLevel(30, 20) === "late");
    check("zero target falls back to default", urgencyLevel(5, 0) === "ok");

    console.log("\n[3] Pure helpers — ticket ordering");
    const t1 = fakeTicket({ id: "t1", createdAt: "2026-01-01T00:00:01.000Z" });
    const t2 = fakeTicket({ id: "t2", createdAt: "2026-01-01T00:00:02.000Z" });
    const t3 = fakeTicket({ id: "t3", createdAt: "2026-01-01T00:00:03.000Z", kitchenPriority: true });
    const sorted = [t1, t2, t3].sort(compareTickets).map((t) => t.id);
    check("priority first, then FIFO", JSON.stringify(sorted) === JSON.stringify(["t3", "t1", "t2"]));

    console.log("\n[4] getKitchenBoard — grouping + exclusion");
    await makeOrder(tenantA.id, { status: "PENDING", productId: productA.id });
    await makeOrder(tenantA.id, { status: "CONFIRMED", productId: productA.id });
    await makeOrder(tenantA.id, { status: "PREPARING", productId: productA.id });
    await makeOrder(tenantA.id, { status: "READY", productId: productA.id });
    await makeOrder(tenantA.id, { status: "DELIVERED", productId: productA.id });
    await makeOrder(tenantA.id, { status: "CANCELLED", productId: productA.id });

    let board = await getKitchenBoard(tenantA.id);
    check("new column has PENDING + CONFIRMED", board.new.length === 2);
    check("preparing column has 1", board.preparing.length === 1);
    check("ready column has 1", board.ready.length === 1);
    const totalTickets = board.new.length + board.preparing.length + board.ready.length;
    check("done/cancelled excluded (4 active)", totalTickets === 4);
    check("targetPrepMins from product", board.preparing[0]?.targetPrepMins === 20);
    check("item snapshot mapped", board.preparing[0]?.items[0]?.name === "Burger");

    console.log("\n[5] getKitchenBoard — client-safe serialization");
    const sample = board.new[0];
    check("total is a number", typeof sample.total === "number");
    check("createdAt is a string", typeof sample.createdAt === "string");
    check("statusSince is a string", typeof sample.statusSince === "string");
    check("no Decimal instance leaks", !((sample.total as unknown) instanceof Prisma.Decimal));
    check("payload is JSON-serializable", (() => {
      try {
        JSON.parse(JSON.stringify(board));
        return true;
      } catch {
        return false;
      }
    })());

    console.log("\n[6] getKitchenBoard — priority-first then FIFO ordering");
    const now = Date.now();
    const o1 = await makeOrder(tenantA.id, {
      status: "CONFIRMED",
      customerName: "FIFO1",
      createdAt: new Date(now - 3000),
    });
    const o2 = await makeOrder(tenantA.id, {
      status: "CONFIRMED",
      customerName: "FIFO2",
      createdAt: new Date(now - 2000),
    });
    const o3 = await makeOrder(tenantA.id, {
      status: "CONFIRMED",
      customerName: "FIFO3",
      kitchenPriority: true,
      createdAt: new Date(now - 1000),
    });
    board = await getKitchenBoard(tenantA.id);
    const orderIds = board.new.map((t) => t.id);
    const idx = (id: string) => orderIds.indexOf(id);
    check("priority order pinned to top", idx(o3.id) === 0);
    check("non-priority kept FIFO (o1 before o2)", idx(o1.id) < idx(o2.id));

    console.log("\n[7] getKitchenBoard — statusSince from latest matching event");
    const prepAt = new Date(now - 5 * 60000); // 5 minutes ago
    const evOrder = await makeOrder(tenantA.id, {
      status: "PREPARING",
      customerName: "EventOrder",
      createdAt: new Date(now - 30 * 60000),
      events: [
        { status: "PENDING", createdAt: new Date(now - 30 * 60000) },
        { status: "CONFIRMED", createdAt: new Date(now - 20 * 60000) },
        { status: "PREPARING", createdAt: prepAt },
      ],
    });
    board = await getKitchenBoard(tenantA.id);
    const evTicket = board.preparing.find((t) => t.id === evOrder.id);
    check(
      "statusSince uses the PREPARING event time, not createdAt",
      evTicket?.statusSince === prepAt.toISOString()
    );

    console.log("\n[8] setKitchenPriority");
    const flagged = await setKitchenPriority(tenantA.id, o1.id, true);
    check("toggle returns ok + count 1", flagged.ok && flagged.count === 1);
    board = await getKitchenBoard(tenantA.id);
    check("priority reflected in board", board.new.find((t) => t.id === o1.id)?.kitchenPriority === true);
    await setKitchenPriority(tenantA.id, o1.id, false);
    board = await getKitchenBoard(tenantA.id);
    check("priority cleared", board.new.find((t) => t.id === o1.id)?.kitchenPriority === false);

    console.log("\n[9] Board transitions respect the state machine");
    check("PENDING→CONFIRMED (Accept) allowed", canTransition("PENDING", "CONFIRMED"));
    check("CONFIRMED→PREPARING (Start) allowed", canTransition("CONFIRMED", "PREPARING"));
    check("PREPARING→READY (Mark ready) allowed", canTransition("PREPARING", "READY"));
    check("READY→OUT_FOR_DELIVERY (Bump delivery) allowed", canTransition("READY", "OUT_FOR_DELIVERY"));
    check("READY→DELIVERED (Bump pickup) allowed", canTransition("READY", "DELIVERED"));
    check("CONFIRMED→READY (skip) blocked", !canTransition("CONFIRMED", "READY"));

    console.log("\n[10] Tenant isolation");
    const bOrder = await makeOrder(tenantB.id, { status: "PREPARING", customerName: "B-only" });
    const aBoard = await getKitchenBoard(tenantA.id);
    const bBoard = await getKitchenBoard(tenantB.id);
    const aIds = new Set([...aBoard.new, ...aBoard.preparing, ...aBoard.ready].map((t) => t.id));
    check("tenant A board excludes tenant B order", !aIds.has(bOrder.id));
    check("tenant B board contains only its own order", bBoard.preparing.length === 1 && bBoard.preparing[0].id === bOrder.id);
    const cross = await setKitchenPriority(tenantB.id, o2.id, true);
    check("cross-tenant priority is a no-op", !cross.ok && cross.count === 0);
    const o2State = await prisma.order.findFirst({ where: { id: o2.id }, select: { kitchenPriority: true } });
    check("tenant A order left untouched", o2State?.kitchenPriority === false);
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
