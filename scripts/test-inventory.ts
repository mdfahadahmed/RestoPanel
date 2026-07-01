/**
 * Test for the Inventory module (/dashboard/inventory).
 *
 * The updateStock server action is a tenant-scoped `updateMany` (it needs an
 * owner session, so — like the other dashboard suites — this exercises the exact
 * scoped data operation the action performs) plus the summary/derivation logic.
 * Verifies stock updates, status derivation and cross-tenant isolation.
 *
 * Run: npx tsx scripts/test-inventory.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";

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

// Mirrors InventoryTable.deriveStatus.
const LOW_THRESHOLD = 5;
function deriveStatus(qty: number | null): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (qty === null) return "IN_STOCK";
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= LOW_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

// Mirrors the updateStock action's scoped write.
async function updateStockScoped(
  restaurantId: string,
  id: string,
  stockQuantity: number | null,
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
) {
  return prisma.product.updateMany({
    where: { id, restaurantId, deletedAt: null },
    data: { stockQuantity, stockStatus },
  });
}

async function main() {
  const tag = `__inv_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "Inv A", ownerName: "A" } });
  const tenantB = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "Inv B", ownerName: "B" } });

  const prodA = await prisma.product.create({
    data: { restaurantId: tenantA.id, name: "Fries", slug: "fries", price: new Prisma.Decimal(3), stockQuantity: 20, stockStatus: "IN_STOCK" },
  });
  const prodB = await prisma.product.create({
    data: { restaurantId: tenantB.id, name: "Wings", slug: "wings", price: new Prisma.Decimal(7), stockQuantity: 8, stockStatus: "IN_STOCK" },
  });

  try {
    console.log("\n[1] Status derivation from quantity");
    check("0 → OUT_OF_STOCK", deriveStatus(0) === "OUT_OF_STOCK");
    check("<=5 → LOW_STOCK", deriveStatus(4) === "LOW_STOCK");
    check(">5 → IN_STOCK", deriveStatus(42) === "IN_STOCK");
    check("null → IN_STOCK", deriveStatus(null) === "IN_STOCK");

    console.log("\n[2] Scoped stock update");
    const upd = await updateStockScoped(tenantA.id, prodA.id, 3, "LOW_STOCK");
    check("update touched exactly 1 row", upd.count === 1);
    const a1 = await prisma.product.findUnique({ where: { id: prodA.id } });
    check("quantity persisted (3)", a1?.stockQuantity === 3);
    check("status persisted (LOW_STOCK)", a1?.stockStatus === "LOW_STOCK");

    const clear = await updateStockScoped(tenantA.id, prodA.id, null, "IN_STOCK");
    check("nullable quantity supported (untracked)", clear.count === 1 && (await prisma.product.findUnique({ where: { id: prodA.id } }))?.stockQuantity === null);

    console.log("\n[3] Tenant isolation");
    const cross = await updateStockScoped(tenantA.id, prodB.id, 0, "OUT_OF_STOCK");
    check("cannot update another tenant's product (0 rows)", cross.count === 0);
    const bUnchanged = await prisma.product.findUnique({ where: { id: prodB.id } });
    check("tenant B product untouched", bUnchanged?.stockQuantity === 8 && bUnchanged?.stockStatus === "IN_STOCK");

    console.log("\n[4] Summary counts (per tenant)");
    await prisma.product.createMany({
      data: [
        { restaurantId: tenantA.id, name: "Low", slug: "low", price: new Prisma.Decimal(1), stockQuantity: 2, stockStatus: "LOW_STOCK" },
        { restaurantId: tenantA.id, name: "Out", slug: "out", price: new Prisma.Decimal(1), stockQuantity: 0, stockStatus: "OUT_OF_STOCK" },
      ],
    });
    const rows = await prisma.product.findMany({ where: { restaurantId: tenantA.id, deletedAt: null } });
    const low = rows.filter((r) => r.stockStatus === "LOW_STOCK").length;
    const out = rows.filter((r) => r.stockStatus === "OUT_OF_STOCK").length;
    check("tenant A summary counts scoped correctly", rows.length === 3 && low === 1 && out === 1, { total: rows.length, low, out });

    console.log("\n[5] Soft-deleted products excluded");
    await prisma.product.update({ where: { id: prodA.id }, data: { deletedAt: new Date() } });
    const visible = await prisma.product.findMany({ where: { restaurantId: tenantA.id, deletedAt: null } });
    check("soft-deleted product excluded from inventory", visible.length === 2 && !visible.some((p) => p.id === prodA.id));
    const delUpdate = await updateStockScoped(tenantA.id, prodA.id, 5, "IN_STOCK");
    check("cannot update stock on a soft-deleted product", delUpdate.count === 0);
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
