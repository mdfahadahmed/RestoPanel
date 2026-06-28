"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { slugify } from "@/lib/slug";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { copyAssets } from "@/lib/upload";
import {
  createProductSchema,
  updateProductSchema,
  quickUpdateSchema,
  type ProductImage,
} from "@/lib/validations/product";

async function uniqueProductSlug(
  restaurantId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 10; i++) {
    const existing = await prisma.product.findFirst({
      where: {
        restaurantId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Verify a category belongs to this tenant (or is intentionally unset).
async function resolveCategoryId(
  restaurantId: string,
  categoryId: string | null | undefined
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (!categoryId) return { ok: true, id: null };
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  return cat ? { ok: true, id: cat.id } : { ok: false };
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

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const cat = await resolveCategoryId(restaurantId, parsed.data.categoryId);
  if (!cat.ok) return actionError("Selected category was not found");

  const slug = await uniqueProductSlug(restaurantId, parsed.data.name);
  const created = await prisma.product.create({
    data: {
      restaurantId,
      slug,
      categoryId: cat.id,
      ...normalise(parsed.data),
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/products");
  return actionOk({ id: created.id });
}

export async function updateProduct(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.product.findFirst({
    where: { id: parsed.data.id, restaurantId },
    select: { id: true, name: true, slug: true },
  });
  if (!existing) return actionError("Product not found");

  const cat = await resolveCategoryId(restaurantId, parsed.data.categoryId);
  if (!cat.ok) return actionError("Selected category was not found");

  const slug =
    existing.name === parsed.data.name
      ? existing.slug
      : await uniqueProductSlug(restaurantId, parsed.data.name, existing.id);

  await prisma.product.update({
    where: { id: existing.id },
    data: { slug, categoryId: cat.id, ...normalise(parsed.data) },
  });

  revalidatePath("/dashboard/products");
  return actionOk();
}

export async function softDeleteProduct(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.product.updateMany({
    where: { id, restaurantId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) return actionError("Product not found");
  revalidatePath("/dashboard/products");
  return actionOk();
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.product.updateMany({
    where: { id, restaurantId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (res.count === 0) return actionError("Product not found");
  revalidatePath("/dashboard/products");
  return actionOk();
}

export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();

  const source = await prisma.product.findFirst({
    where: { id, restaurantId, deletedAt: null },
  });
  if (!source) return actionError("Product not found");

  const name = `${source.name} (Copy)`.slice(0, 120);
  const slug = await uniqueProductSlug(restaurantId, name);

  // Give the duplicate its OWN image files so editing/deleting images on one
  // product never affects the other. copyAssets re-stores each asset via the
  // configured provider (local today, Cloudinary-ready) and returns new refs.
  const sourceImages = (source.images as unknown as ProductImage[]) ?? [];
  const copiedImages = await copyAssets(restaurantId, "products", sourceImages);

  // Copy every other field except identity/timestamps. The duplicate starts as
  // a hidden DRAFT so it can be tweaked before going live.
  const created = await prisma.product.create({
    data: {
      restaurantId,
      categoryId: source.categoryId,
      name,
      slug,
      description: source.description,
      shortDescription: source.shortDescription,
      images: copiedImages as unknown as Prisma.InputJsonValue,
      price: source.price,
      comparePrice: source.comparePrice,
      costPrice: source.costPrice,
      discount: source.discount,
      sku: source.sku,
      barcode: source.barcode,
      calories: source.calories,
      stockQuantity: source.stockQuantity,
      stockStatus: source.stockStatus,
      status: "DRAFT",
      isAvailable: false,
      featured: source.featured,
      bestSeller: source.bestSeller,
      prepTimeMins: source.prepTimeMins,
      ingredients: source.ingredients,
      extras: (source.extras ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      variants: (source.variants ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/products");
  return actionOk({ id: created.id });
}

export async function quickUpdateProduct(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = quickUpdateSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const { id, ...fields } = parsed.data;
  const res = await prisma.product.updateMany({
    where: { id, restaurantId, deletedAt: null },
    data: fields,
  });
  if (res.count === 0) return actionError("Product not found");
  revalidatePath("/dashboard/products");
  return actionOk();
}
