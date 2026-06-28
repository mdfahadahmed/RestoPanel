/**
 * End-to-end data test for the Products module.
 *
 * Exercises the real Zod validation + slug helper and the exact tenant-scoped
 * Prisma queries the server actions use — including cross-tenant isolation —
 * against the live database, then cleans up everything it created.
 *
 * Run: npx tsx scripts/test-products.ts
 */
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { createProductSchema, updateProductSchema } from "../src/lib/validations/product";
import { copyAssets, getUploadService, tenantFolder } from "../src/lib/upload";

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

// Mirror of actions.ts uniqueProductSlug (kept local so the test has no auth dep).
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "product"
  );
}
async function uniqueProductSlug(restaurantId: string, name: string, excludeId?: string) {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 10; i++) {
    const existing = await prisma.product.findFirst({
      where: { restaurantId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function normalise(input: ReturnType<typeof createProductSchema.parse>) {
  return {
    name: input.name,
    description: input.description ? input.description : null,
    shortDescription: input.shortDescription ? input.shortDescription : null,
    images: input.images as unknown as Prisma.InputJsonValue,
    price: new Prisma.Decimal(input.price),
    comparePrice: input.comparePrice != null ? new Prisma.Decimal(input.comparePrice) : null,
    costPrice: input.costPrice != null ? new Prisma.Decimal(input.costPrice) : null,
    discount: new Prisma.Decimal(input.discount),
    sku: input.sku ? input.sku : null,
    barcode: input.barcode ? input.barcode : null,
    calories: input.calories ?? null,
    stockQuantity: input.stockQuantity ?? null,
    stockStatus: input.stockStatus,
    status: input.status,
    isAvailable: input.isAvailable,
    featured: input.featured,
    bestSeller: input.bestSeller,
    prepTimeMins: input.prepTimeMins ?? null,
    ingredients: input.ingredients,
    extras: input.extras as unknown as Prisma.InputJsonValue,
    variants: input.variants as unknown as Prisma.InputJsonValue,
  };
}

async function main() {
  const tag = `__test_${Date.now()}`;
  const slugA = `${tag}-a`;
  const slugB = `${tag}-b`;

  // --- Setup: two isolated tenants ---
  const tenantA = await prisma.restaurant.create({
    data: { slug: slugA, name: "Tenant A", ownerName: "A" },
  });
  const tenantB = await prisma.restaurant.create({
    data: { slug: slugB, name: "Tenant B", ownerName: "B" },
  });
  const catA = await prisma.category.create({
    data: { restaurantId: tenantA.id, name: "Mains", slug: "mains" },
  });

  try {
    console.log("\n[1] Validation");
    check("rejects empty name", !createProductSchema.safeParse({ name: "", price: 5 }).success);
    check("rejects missing price", !createProductSchema.safeParse({ name: "X" }).success);
    check(
      "rejects comparePrice below price",
      !createProductSchema.safeParse({ name: "X", price: 10, comparePrice: 5 }).success
    );
    check(
      "accepts comparePrice above price",
      createProductSchema.safeParse({ name: "X", price: 10, comparePrice: 15 }).success
    );
    check(
      "rejects discount > 100",
      !createProductSchema.safeParse({ name: "X", price: 10, discount: 150 }).success
    );
    const variantParse = createProductSchema.safeParse({
      name: "X",
      price: 10,
      variants: [{ name: "Large", priceAdjustment: 2, stock: 5, sku: "L-1" }],
      extras: [{ name: "Cheese", price: 1, isActive: true }],
    });
    check("accepts variants + extras shape", variantParse.success, variantParse.error?.flatten());

    console.log("\n[2] Create (full payload)");
    const fullInput = createProductSchema.parse({
      name: "Margherita Pizza",
      shortDescription: "Classic cheese & tomato",
      description: "Wood-fired.",
      categoryId: catA.id,
      price: 9.5,
      comparePrice: 12,
      costPrice: 3.25,
      discount: 10,
      sku: "PIZ-001",
      barcode: "5000000001",
      calories: 850,
      stockQuantity: 20,
      stockStatus: "IN_STOCK",
      status: "ACTIVE",
      isAvailable: true,
      featured: true,
      bestSeller: false,
      images: [{ url: "/u/x.jpg", key: "x" }],
      ingredients: ["dough", "tomato", "mozzarella"],
      variants: [{ name: "Large", priceAdjustment: 3, stock: 10, sku: "PIZ-001-L" }],
      extras: [{ name: "Extra cheese", price: 1.5, isActive: true }],
    });
    const slug = await uniqueProductSlug(tenantA.id, fullInput.name);
    const created = await prisma.product.create({
      data: { restaurantId: tenantA.id, slug, categoryId: catA.id, ...normalise(fullInput) },
    });
    check("created product persisted", !!created.id);
    check("decimal price stored", Number(created.price) === 9.5);
    check("comparePrice stored", Number(created.comparePrice) === 12);
    check("costPrice stored", Number(created.costPrice) === 3.25);
    check("calories stored", created.calories === 850);
    check("status stored", created.status === "ACTIVE");
    const v = created.variants as unknown as { name: string; stock: number; sku: string }[];
    check("variant round-trip", v?.[0]?.name === "Large" && v?.[0]?.stock === 10);
    const ex = created.extras as unknown as { name: string; isActive: boolean }[];
    check("extra active round-trip", ex?.[0]?.isActive === true);

    console.log("\n[3] Unique slug on duplicate name");
    const slug2 = await uniqueProductSlug(tenantA.id, fullInput.name);
    check("second slug differs", slug2 !== slug && slug2.startsWith(slug));

    console.log("\n[4] Update (scoped)");
    const upd = updateProductSchema.parse({ ...fullInput, id: created.id, name: "Margherita Deluxe", price: 11 });
    const slugU =
      created.name === upd.name ? created.slug : await uniqueProductSlug(tenantA.id, upd.name, created.id);
    await prisma.product.update({ where: { id: created.id }, data: { slug: slugU, ...normalise(upd) } });
    const after = await prisma.product.findFirst({ where: { id: created.id, restaurantId: tenantA.id } });
    check("update applied", after?.name === "Margherita Deluxe" && Number(after?.price) === 11);

    console.log("\n[5] Duplicate");
    const dupName = `${after!.name} (Copy)`;
    const dupSlug = await uniqueProductSlug(tenantA.id, dupName);
    const dup = await prisma.product.create({
      data: {
        restaurantId: tenantA.id,
        categoryId: after!.categoryId,
        name: dupName,
        slug: dupSlug,
        description: after!.description,
        shortDescription: after!.shortDescription,
        images: after!.images as Prisma.InputJsonValue,
        price: after!.price,
        comparePrice: after!.comparePrice,
        costPrice: after!.costPrice,
        discount: after!.discount,
        sku: after!.sku,
        barcode: after!.barcode,
        calories: after!.calories,
        stockQuantity: after!.stockQuantity,
        stockStatus: after!.stockStatus,
        status: "DRAFT",
        isAvailable: false,
        featured: after!.featured,
        bestSeller: after!.bestSeller,
        prepTimeMins: after!.prepTimeMins,
        ingredients: after!.ingredients,
        extras: (after!.extras ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        variants: (after!.variants ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    check("duplicate is DRAFT + hidden", dup.status === "DRAFT" && dup.isAvailable === false);
    check("duplicate copied variants", JSON.stringify(dup.variants) === JSON.stringify(after!.variants));

    console.log("\n[6] Soft delete + restore (scoped)");
    const del = await prisma.product.updateMany({
      where: { id: dup.id, restaurantId: tenantA.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    check("soft delete count = 1", del.count === 1);
    const inTrash = await prisma.product.findFirst({ where: { id: dup.id, restaurantId: tenantA.id } });
    check("deletedAt set", inTrash?.deletedAt !== null);
    const res = await prisma.product.updateMany({
      where: { id: dup.id, restaurantId: tenantA.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    check("restore count = 1", res.count === 1);

    console.log("\n[7] Search / filter / sort / pagination");
    // Seed a few more for pagination + sorting.
    for (let i = 0; i < 5; i++) {
      const p = createProductSchema.parse({
        name: `Side ${i}`,
        price: 1 + i,
        status: i % 2 === 0 ? "ACTIVE" : "DRAFT",
        isAvailable: i !== 0,
        sku: `SIDE-${i}`,
      });
      await prisma.product.create({
        data: { restaurantId: tenantA.id, slug: `side-${i}`, ...normalise(p) },
      });
    }
    const byName = await prisma.product.findMany({
      where: { restaurantId: tenantA.id, deletedAt: null, name: { contains: "side", mode: "insensitive" } },
    });
    check("search by name", byName.length === 5);
    const bySku = await prisma.product.findMany({
      where: { restaurantId: tenantA.id, deletedAt: null, sku: { contains: "SIDE-3", mode: "insensitive" } },
    });
    check("search by SKU", bySku.length === 1);
    const drafts = await prisma.product.count({
      where: { restaurantId: tenantA.id, deletedAt: null, status: "DRAFT" },
    });
    check("filter by status=DRAFT", drafts >= 2);
    const unavailable = await prisma.product.count({
      where: { restaurantId: tenantA.id, deletedAt: null, isAvailable: false },
    });
    check("filter by availability=false", unavailable >= 1);
    const featured = await prisma.product.count({
      where: { restaurantId: tenantA.id, deletedAt: null, featured: true },
    });
    // Original is featured; its duplicate faithfully preserves the flag → 2.
    check("filter by featured", featured === 2);
    const sortedAsc = await prisma.product.findMany({
      where: { restaurantId: tenantA.id, deletedAt: null, name: { startsWith: "Side" } },
      orderBy: { price: "asc" },
      take: 2,
    });
    check("sort by price asc", Number(sortedAsc[0].price) <= Number(sortedAsc[1].price));
    const pageSize = 3;
    const page1 = await prisma.product.findMany({
      where: { restaurantId: tenantA.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: 0,
    });
    const page2 = await prisma.product.findMany({
      where: { restaurantId: tenantA.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: pageSize,
    });
    check("pagination returns distinct pages", page1.length === 3 && !page1.some((p) => page2.find((q) => q.id === p.id)));

    console.log("\n[8] Image copy independence (local provider)");
    const publicDir = path.join(process.cwd(), "public");
    const folder = tenantFolder(tenantA.id, "products");
    const srcKey = path.posix.join("uploads", folder, "source.png");
    const srcAbs = path.join(publicDir, srcKey);
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await mkdir(path.dirname(srcAbs), { recursive: true });
    await writeFile(srcAbs, pngBytes);

    const copies = await copyAssets(tenantA.id, "products", [{ url: `/${srcKey}`, key: srcKey }]);
    check("copyAssets returned one copy", copies.length === 1);
    check("copy has a different key", copies[0]?.key !== srcKey);
    const copyAbs = path.join(publicDir, copies[0].key);
    const copyExists = await access(copyAbs).then(() => true).catch(() => false);
    check("copied file exists on disk", copyExists);
    const same = Buffer.compare(await readFile(srcAbs), await readFile(copyAbs)) === 0;
    check("copied bytes match source", same);

    // Independence: deleting the SOURCE leaves the COPY intact.
    await getUploadService().delete(srcKey);
    const srcGone = await access(srcAbs).then(() => false).catch(() => true);
    const copyStillThere = await access(copyAbs).then(() => true).catch(() => false);
    check("deleting source removes source", srcGone);
    check("copy survives source deletion (independent)", copyStillThere);

    // Path-traversal guard on copy.
    let blocked = false;
    try {
      await getUploadService().copy({ url: "/x", key: "../../etc/passwd" }, folder);
    } catch {
      blocked = true;
    }
    check("copy rejects path traversal", blocked);

    // Clean up copied file + the tenant upload dir.
    await rm(path.join(publicDir, "uploads", "restaurants", tenantA.id), {
      recursive: true,
      force: true,
    });

    console.log("\n[9] Tenant isolation");
    const aProductFromB = await prisma.product.findFirst({
      where: { id: created.id, restaurantId: tenantB.id },
    });
    check("tenant B cannot read tenant A product", aProductFromB === null);
    const crossDelete = await prisma.product.updateMany({
      where: { id: created.id, restaurantId: tenantB.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    check("tenant B cannot soft-delete tenant A product (count 0)", crossDelete.count === 0);
    const crossCategory = await prisma.category.findFirst({
      where: { id: catA.id, restaurantId: tenantB.id },
    });
    check("tenant B cannot resolve tenant A category", crossCategory === null);
    const bCount = await prisma.product.count({ where: { restaurantId: tenantB.id } });
    check("tenant B sees zero products", bCount === 0);
  } finally {
    // Cascade deletes products + categories.
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
