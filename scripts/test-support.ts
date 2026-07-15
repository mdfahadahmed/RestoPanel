/**
 * Tests for the tenant-scoped owner support module: create/list/get/reply, and
 * critically that one restaurant can never see or reply to another's tickets.
 *
 * Run: npx tsx scripts/test-support.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  listTicketsForRestaurant,
  getTicketForRestaurant,
  createTicketForRestaurant,
  ownerReplyToTicket,
} from "../src/lib/support/tenant";

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
  const tag = `__suptest_${Date.now()}`;
  const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "Bistro A", ownerName: "A" }, select: { id: true } });
  const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "Bistro B", ownerName: "B" }, select: { id: true } });

  try {
    console.log("\n[1] Create + list");
    const t = await createTicketForRestaurant({
      restaurantId: a.id, subject: "Payments issue", requesterName: "Alice",
      requesterEmail: "alice@a.dev", body: "Cards aren't settling.", priority: "HIGH",
    });
    check("ticket created", !!t.id);
    const listA = await listTicketsForRestaurant(a.id);
    check("A lists its ticket", listA.total === 1 && listA.rows[0].subject === "Payments issue", listA.total);
    check("open count reflects it", listA.openCount === 1);

    console.log("\n[2] Get + owner reply reopens");
    const full = await getTicketForRestaurant(a.id, t.id);
    check("get returns thread with first message (OWNER)", !!full && full.messages.length === 1 && full.messages[0].authorType === "OWNER");
    // Simulate an admin reply moving it to PENDING, then owner replies → OPEN.
    await prisma.supportTicket.update({ where: { id: t.id }, data: { status: "PENDING" } });
    const reply = await ownerReplyToTicket(a.id, t.id, "Alice", "Still happening today.");
    check("owner reply created", !!reply);
    const after = await getTicketForRestaurant(a.id, t.id);
    check("reply appended + status back to OPEN", !!after && after.messages.length === 2 && after.status === "OPEN", after?.status);

    console.log("\n[3] Tenant isolation — the golden rule");
    check("B cannot see A's ticket via get", (await getTicketForRestaurant(b.id, t.id)) === null);
    const listB = await listTicketsForRestaurant(b.id);
    check("B's ticket list is empty", listB.total === 0);
    const stolenReply = await ownerReplyToTicket(b.id, t.id, "Mallory", "hijack");
    check("B cannot reply to A's ticket", stolenReply === null);
    const stillTwo = await getTicketForRestaurant(a.id, t.id);
    check("A's ticket unchanged after B's attempt", !!stillTwo && stillTwo.messages.length === 2);

    console.log("\n[4] Closed tickets can't be replied to");
    await prisma.supportTicket.update({ where: { id: t.id }, data: { status: "CLOSED" } });
    check("reply to closed ticket rejected", (await ownerReplyToTicket(a.id, t.id, "Alice", "hello?")) === null);
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
