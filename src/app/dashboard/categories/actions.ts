"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { slugify } from "@/lib/slug";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category";

// Produce a category slug unique within the restaurant (tenant-scoped).
async function uniqueCategorySlug(
  restaurantId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 8; i++) {
    const existing = await prisma.category.findFirst({
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

export async function createCategory(
  input: unknown
): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const slug = await uniqueCategorySlug(restaurantId, parsed.data.name);
  // Append after the current last category.
  const last = await prisma.category.findFirst({
    where: { restaurantId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.category.create({
    data: {
      restaurantId,
      name: parsed.data.name,
      slug,
      isActive: parsed.data.isActive,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/dashboard/categories");
  return actionOk();
}

export async function updateCategory(
  input: unknown
): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  // Ensure the category belongs to this tenant before mutating.
  const existing = await prisma.category.findFirst({
    where: { id: parsed.data.id, restaurantId },
    select: { id: true, name: true, slug: true },
  });
  if (!existing) return actionError("Category not found");

  const slug =
    existing.name === parsed.data.name
      ? existing.slug
      : await uniqueCategorySlug(restaurantId, parsed.data.name, existing.id);

  await prisma.category.update({
    where: { id: existing.id },
    data: { name: parsed.data.name, slug, isActive: parsed.data.isActive },
  });

  revalidatePath("/dashboard/categories");
  return actionOk();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();

  // Scope the delete to the tenant — never delete by id alone.
  const result = await prisma.category.deleteMany({ where: { id, restaurantId } });
  if (result.count === 0) return actionError("Category not found");

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
  return actionOk();
}
