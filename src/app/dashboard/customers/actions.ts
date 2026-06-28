"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  createCustomerSchema,
  updateCustomerSchema,
  setStatusSchema,
  setTagsSchema,
  addNoteSchema,
  updateNoteSchema,
} from "@/lib/validations/customer";

// Tenant-scoped duplicate checks. Returns field errors if a clash is found.
async function findDuplicates(
  restaurantId: string,
  phone: string,
  email: string | undefined,
  excludeId?: string
): Promise<Record<string, string[]> | null> {
  const errors: Record<string, string[]> = {};

  const phoneClash = await prisma.customer.findFirst({
    where: { restaurantId, phone, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (phoneClash) errors.phone = ["A customer with this phone already exists"];

  if (email) {
    const emailClash = await prisma.customer.findFirst({
      where: {
        restaurantId,
        email: { equals: email, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (emailClash) errors.email = ["A customer with this email already exists"];
  }

  return Object.keys(errors).length ? errors : null;
}

export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const email = data.email || undefined;

  const dup = await findDuplicates(restaurantId, data.phone, email);
  if (dup) return actionError("Please fix the errors below", dup);

  try {
    const created = await prisma.customer.create({
      data: {
        restaurantId,
        name: data.name,
        phone: data.phone,
        email: email ?? null,
        address: data.address || null,
        status: data.status,
        tags: data.tags,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/customers");
    return actionOk({ id: created.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return actionError("Please fix the errors below", {
        phone: ["A customer with this phone already exists"],
      });
    }
    throw e;
  }
}

export async function updateCustomer(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const email = data.email || undefined;

  const existing = await prisma.customer.findFirst({
    where: { id: data.id, restaurantId },
    select: { id: true },
  });
  if (!existing) return actionError("Customer not found");

  const dup = await findDuplicates(restaurantId, data.phone, email, data.id);
  if (dup) return actionError("Please fix the errors below", dup);

  await prisma.customer.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      phone: data.phone,
      email: email ?? null,
      address: data.address || null,
      status: data.status,
      tags: data.tags,
    },
  });
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${data.id}`);
  return actionOk();
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.customer.deleteMany({ where: { id, restaurantId } });
  if (res.count === 0) return actionError("Customer not found");
  revalidatePath("/dashboard/customers");
  return actionOk();
}

export async function setCustomerStatus(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await prisma.customer.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { status: parsed.data.status },
  });
  if (res.count === 0) return actionError("Customer not found");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${parsed.data.id}`);
  return actionOk();
}

export async function setCustomerTags(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = setTagsSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  // De-duplicate while preserving order.
  const tags = [...new Set(parsed.data.tags.map((t) => t.trim()).filter(Boolean))];
  const res = await prisma.customer.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { tags },
  });
  if (res.count === 0) return actionError("Customer not found");
  revalidatePath(`/dashboard/customers/${parsed.data.id}`);
  return actionOk();
}

export async function addCustomerNote(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  // Ensure the customer belongs to this tenant before attaching a note.
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, restaurantId },
    select: { id: true },
  });
  if (!customer) return actionError("Customer not found");

  await prisma.customerNote.create({
    data: { customerId: customer.id, restaurantId, body: parsed.data.body },
  });
  revalidatePath(`/dashboard/customers/${customer.id}`);
  return actionOk();
}

export async function updateCustomerNote(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const res = await prisma.customerNote.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { body: parsed.data.body },
  });
  if (res.count === 0) return actionError("Note not found");
  revalidatePath("/dashboard/customers");
  return actionOk();
}

export async function deleteCustomerNote(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const res = await prisma.customerNote.deleteMany({ where: { id, restaurantId } });
  if (res.count === 0) return actionError("Note not found");
  revalidatePath("/dashboard/customers");
  return actionOk();
}
