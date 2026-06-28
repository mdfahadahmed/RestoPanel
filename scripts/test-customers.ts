/**
 * End-to-end data test for the Customers (CRM) module.
 *
 * Exercises the real Zod schemas + the exact tenant-scoped Prisma logic the
 * server actions and queries use (CRUD, duplicate email/phone validation,
 * search, filters incl. aggregate thresholds, pagination, notes, tags, status,
 * export shape) plus cross-tenant isolation — against the live database, then
 * cleans up everything it created.
 *
 * Run: npx tsx scripts/test-customers.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createCustomerSchema } from "../src/lib/validations/customer";
import { customerIdsForAggregates } from "../src/app/dashboard/customers/stats";

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

// Mirror of the action's duplicate check.
async function findDuplicates(restaurantId: string, phone: string, email: string | undefined, excludeId?: string) {
  const errors: Record<string, string[]> = {};
  const phoneClash = await prisma.customer.findFirst({
    where: { restaurantId, phone, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (phoneClash) errors.phone = ["dup phone"];
  if (email) {
    const emailClash = await prisma.customer.findFirst({
      where: { restaurantId, email: { equals: email, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (emailClash) errors.email = ["dup email"];
  }
  return Object.keys(errors).length ? errors : null;
}

async function createCustomer(restaurantId: string, input: unknown) {
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const email = d.email || undefined;
  const dup = await findDuplicates(restaurantId, d.phone, email);
  if (dup) return { ok: false as const, errors: dup };
  const c = await prisma.customer.create({
    data: { restaurantId, name: d.name, phone: d.phone, email: email ?? null, address: d.address || null, status: d.status, tags: d.tags },
  });
  return { ok: true as const, customer: c };
}

async function main() {
  const tag = `__ctest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "CA", ownerName: "A" } });
  const tenantB = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "CB", ownerName: "B" } });

  try {
    console.log("\n[1] Validation");
    check("rejects empty name", !createCustomerSchema.safeParse({ name: "", phone: "0700" }).success);
    check("rejects missing phone", !createCustomerSchema.safeParse({ name: "Joe" }).success);
    check("rejects bad email", !createCustomerSchema.safeParse({ name: "Joe", phone: "0700", email: "nope" }).success);
    check("rejects bad phone chars", !createCustomerSchema.safeParse({ name: "Joe", phone: "abc$$" }).success);
    check("accepts valid", createCustomerSchema.safeParse({ name: "Joe", phone: "+44 700 900", email: "j@x.com" }).success);

    console.log("\n[2] Create + duplicate validation");
    const a1 = await createCustomer(tenantA.id, { name: "Alice", phone: "0700000001", email: "alice@x.com", tags: ["Regular", "VIP"], status: "ACTIVE" });
    check("created customer", a1.ok);
    const dupPhone = await createCustomer(tenantA.id, { name: "Other", phone: "0700000001", email: "other@x.com" });
    check("rejects duplicate phone", !dupPhone.ok && !!(dupPhone as { errors: Record<string, unknown> }).errors.phone);
    const dupEmail = await createCustomer(tenantA.id, { name: "Other", phone: "0700000002", email: "ALICE@x.com" });
    check("rejects duplicate email (case-insensitive)", !dupEmail.ok && !!(dupEmail as { errors: Record<string, unknown> }).errors.email);

    if (!a1.ok) throw new Error("setup failed");
    const alice = a1.customer;

    console.log("\n[3] Update (scoped) + duplicate-on-update");
    // Second customer to clash against.
    const a2 = await createCustomer(tenantA.id, { name: "Bob", phone: "0700000003", email: "bob@x.com" });
    if (!a2.ok) throw new Error("setup failed");
    const clash = await findDuplicates(tenantA.id, "0700000003", "bob@x.com", alice.id);
    check("update detects clash with another customer", clash !== null && !!clash.phone);
    const selfOk = await findDuplicates(tenantA.id, alice.phone, "alice@x.com", alice.id);
    check("update allows keeping own phone/email", selfOk === null);
    await prisma.customer.update({ where: { id: alice.id }, data: { name: "Alice Smith", address: "1 High St" } });
    const updated = await prisma.customer.findFirst({ where: { id: alice.id, restaurantId: tenantA.id } });
    check("update applied", updated?.name === "Alice Smith" && updated?.address === "1 High St");

    console.log("\n[4] Notes CRUD (scoped)");
    const note = await prisma.customerNote.create({ data: { customerId: alice.id, restaurantId: tenantA.id, body: "Likes extra spicy" } });
    check("note added", !!note.id);
    const upd = await prisma.customerNote.updateMany({ where: { id: note.id, restaurantId: tenantA.id }, data: { body: "Allergic to nuts" } });
    check("note updated (scoped)", upd.count === 1);
    const crossNote = await prisma.customerNote.updateMany({ where: { id: note.id, restaurantId: tenantB.id }, data: { body: "hax" } });
    check("tenant B cannot edit tenant A note", crossNote.count === 0);
    const del = await prisma.customerNote.deleteMany({ where: { id: note.id, restaurantId: tenantA.id } });
    check("note deleted (scoped)", del.count === 1);

    console.log("\n[5] Tags + status");
    await prisma.customer.updateMany({ where: { id: alice.id, restaurantId: tenantA.id }, data: { tags: ["Corporate", "New Customer"] } });
    const tagged = await prisma.customer.findFirst({ where: { id: alice.id }, select: { tags: true } });
    check("tags updated", tagged?.tags.join(",") === "Corporate,New Customer");
    const byTag = await prisma.customer.findMany({ where: { restaurantId: tenantA.id, tags: { has: "Corporate" } } });
    check("filter by tag (has)", byTag.length === 1);
    await prisma.customer.updateMany({ where: { id: alice.id, restaurantId: tenantA.id }, data: { status: "BLOCKED" } });
    const blocked = await prisma.customer.count({ where: { restaurantId: tenantA.id, status: "BLOCKED" } });
    check("status filter", blocked === 1);

    console.log("\n[6] Search / sort / pagination");
    for (let i = 0; i < 5; i++) {
      await createCustomer(tenantA.id, { name: `Charlie ${i}`, phone: `07111000${i}0`, email: `charlie${i}@x.com` });
    }
    const byName = await prisma.customer.findMany({ where: { restaurantId: tenantA.id, name: { contains: "charlie", mode: "insensitive" } } });
    check("search by name", byName.length === 5);
    const byEmail = await prisma.customer.findMany({ where: { restaurantId: tenantA.id, email: { contains: "bob@", mode: "insensitive" } } });
    check("search by email", byEmail.length === 1);
    const byId = await prisma.customer.findMany({ where: { restaurantId: tenantA.id, id: { contains: alice.id.slice(0, 8) } } });
    check("search by customer ID", byId.length === 1);
    const total = await prisma.customer.count({ where: { restaurantId: tenantA.id } });
    const p1 = await prisma.customer.findMany({ where: { restaurantId: tenantA.id }, orderBy: { createdAt: "desc" }, take: 3, skip: 0 });
    const p2 = await prisma.customer.findMany({ where: { restaurantId: tenantA.id }, orderBy: { createdAt: "desc" }, take: 3, skip: 3 });
    check("pagination distinct pages", p1.length === 3 && !p1.some((a) => p2.find((b) => b.id === a.id)) && total === 7);
    const sortedByOrders = await prisma.customer.findMany({ where: { restaurantId: tenantA.id }, orderBy: { orders: { _count: "desc" } }, take: 1 });
    check("sort by order count works", sortedByOrders.length === 1);

    console.log("\n[7] Aggregate filters (min orders / spending)");
    // Give Bob 3 orders, two paid totalling 50.
    for (let i = 0; i < 3; i++) {
      await prisma.order.create({
        data: {
          restaurantId: tenantA.id,
          customerId: a2.customer.id,
          orderNumber: `C${i}`,
          status: "DELIVERED",
          paymentStatus: i < 2 ? "PAID" : "UNPAID",
          paymentMethod: "CASH",
          subtotal: new Prisma.Decimal(25),
          total: new Prisma.Decimal(25),
        },
      });
    }
    const minOrderIds = await customerIdsForAggregates(tenantA.id, 3, 0);
    check("min orders >= 3 matches Bob only", minOrderIds?.length === 1 && minOrderIds[0] === a2.customer.id);
    const minSpendIds = await customerIdsForAggregates(tenantA.id, 0, 40);
    check("min spending >= 40 matches Bob only", minSpendIds?.length === 1 && minSpendIds[0] === a2.customer.id);
    const both = await customerIdsForAggregates(tenantA.id, 3, 100);
    check("combined thresholds intersect (spend 100 excludes)", both?.length === 0);
    const none = await customerIdsForAggregates(tenantA.id, 0, 0);
    check("no aggregate filter returns null", none === null);

    console.log("\n[8] Export shape");
    const exportRows = await prisma.customer.findMany({
      where: { restaurantId: tenantA.id },
      include: { _count: { select: { orders: true } }, orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    check("export query returns rows with counts", exportRows.length === total && exportRows.every((r) => typeof r._count.orders === "number"));

    console.log("\n[9] Tenant isolation");
    const aFromB = await prisma.customer.findFirst({ where: { id: alice.id, restaurantId: tenantB.id } });
    check("tenant B cannot read tenant A customer", aFromB === null);
    const crossUpdate = await prisma.customer.updateMany({ where: { id: alice.id, restaurantId: tenantB.id }, data: { status: "ACTIVE" } });
    check("tenant B cannot update tenant A customer", crossUpdate.count === 0);
    const crossDelete = await prisma.customer.deleteMany({ where: { id: alice.id, restaurantId: tenantB.id } });
    check("tenant B cannot delete tenant A customer", crossDelete.count === 0);
    const bCount = await prisma.customer.count({ where: { restaurantId: tenantB.id } });
    check("tenant B has zero customers", bCount === 0);

    console.log("\n[10] Delete unlinks orders (SetNull), keeps order");
    await prisma.customer.deleteMany({ where: { id: a2.customer.id, restaurantId: tenantA.id } });
    const orphan = await prisma.order.findFirst({ where: { restaurantId: tenantA.id, orderNumber: "C0" }, select: { customerId: true } });
    check("order survives customer deletion, customerId nulled", orphan !== null && orphan.customerId === null);
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
