/**
 * End-to-end test for the Reviews module. Tests public submission (delivered
 * order, one-per-order), owner reply/hide/delete (tenant-scoped), analytics
 * (avg + distribution), and tenant isolation.
 *
 * Run: npx tsx scripts/test-reviews.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createReviewPublic } from "../src/app/r/[slug]/actions";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

async function main() {
  const tag = `rv${Date.now().toString(36)}`;
  const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "A", ownerName: "A" } });
  const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "B", ownerName: "B" } });

  async function makeOrder(rid: string, num: string, status: "DELIVERED" | "PENDING") {
    return prisma.order.create({ data: { restaurantId: rid, orderNumber: num, status, paymentStatus: "PAID", paymentMethod: "CASH", subtotal: new Prisma.Decimal(10), total: new Prisma.Decimal(10), customerName: "Bob" } });
  }
  const delivered = await makeOrder(a.id, "0001", "DELIVERED");
  const pendingOrder = await makeOrder(a.id, "0002", "PENDING");

  try {
    console.log("\n[1] Public submission rules");
    const notDelivered = await createReviewPublic(`${tag}-a`, { orderNumber: "0002", rating: 5, comment: "early" });
    check("cannot review a non-delivered order", !notDelivered.ok);
    const badRating = await createReviewPublic(`${tag}-a`, { orderNumber: "0001", rating: 9 });
    check("rating > 5 rejected", !badRating.ok);
    const ok = await createReviewPublic(`${tag}-a`, { orderNumber: "0001", rating: 5, comment: "Great!", name: "Bob" });
    check("delivered order can be reviewed", ok.ok, ok);
    const dupe = await createReviewPublic(`${tag}-a`, { orderNumber: "0001", rating: 3 });
    check("one review per order enforced", !dupe.ok);
    const unknownSlug = await createReviewPublic("nope-nope", { orderNumber: "0001", rating: 5 });
    check("unknown slug rejected", !unknownSlug.ok);

    const review = await prisma.review.findFirst({ where: { restaurantId: a.id } });
    check("review linked to order + customer name", review?.orderId === delivered.id && review?.customerName === "Bob");

    console.log("\n[2] Owner reply / hide / delete (scoped)");
    const replied = await prisma.review.updateMany({ where: { id: review!.id, restaurantId: a.id }, data: { reply: "Thanks!", repliedAt: new Date() } });
    check("owner can reply (scoped)", replied.count === 1);
    const crossReply = await prisma.review.updateMany({ where: { id: review!.id, restaurantId: b.id }, data: { reply: "hack" } });
    check("tenant B cannot reply to tenant A review", crossReply.count === 0);
    const hidden = await prisma.review.updateMany({ where: { id: review!.id, restaurantId: a.id }, data: { isPublished: false } });
    check("owner can hide review", hidden.count === 1);

    console.log("\n[3] Analytics");
    // Add more reviews (manual, varied ratings) for distribution.
    for (const [num, rating] of [["0003", 4], ["0004", 2]] as const) {
      const o = await makeOrder(a.id, num, "DELIVERED");
      await prisma.review.create({ data: { restaurantId: a.id, orderId: o.id, customerName: "X", rating } });
    }
    const agg = await prisma.review.aggregate({ where: { restaurantId: a.id }, _avg: { rating: true }, _count: { _all: true } });
    check("average rating computed (5+4+2)/3 ≈ 3.67", Math.round((agg._avg.rating ?? 0) * 100) / 100 === 3.67, agg._avg.rating);
    check("total reviews = 3", agg._count._all === 3);
    const dist = await prisma.review.groupBy({ by: ["rating"], where: { restaurantId: a.id }, _count: { _all: true } });
    check("distribution has 3 distinct ratings", dist.length === 3);

    console.log("\n[4] Tenant isolation");
    const bReviews = await prisma.review.count({ where: { restaurantId: b.id } });
    check("tenant B has no reviews", bReviews === 0);
    const aFromB = await prisma.review.findFirst({ where: { id: review!.id, restaurantId: b.id } });
    check("tenant B cannot read tenant A review", aFromB === null);
    const crossDelete = await prisma.review.deleteMany({ where: { id: review!.id, restaurantId: b.id } });
    check("tenant B cannot delete tenant A review", crossDelete.count === 0);
    const ownDelete = await prisma.review.deleteMany({ where: { id: review!.id, restaurantId: a.id } });
    check("owner can delete own review", ownDelete.count === 1);

    void pendingOrder;
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
