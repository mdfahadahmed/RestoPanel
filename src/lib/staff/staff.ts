import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAssignableRole } from "@/lib/staff/permissions";

export * from "@/lib/staff/permissions";
export * from "@/lib/staff/shared";

/** All staff for a tenant, owner first then by name. */
export async function listStaff(restaurantId: string) {
  return prisma.user.findMany({
    where: { restaurantId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string | null;
}

export type StaffResult = { ok: true; userId: string } | { ok: false; error: string };

/** Create a staff member (any assignable role — never OWNER). Email is global. */
export async function createStaff(
  restaurantId: string,
  input: CreateStaffInput
): Promise<StaffResult> {
  if (!isAssignableRole(input.role)) return { ok: false, error: "Invalid role" };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      restaurantId,
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
      phone: input.phone?.trim() || null,
    },
    select: { id: true },
  });
  return { ok: true, userId: user.id };
}

export interface UpdateStaffInput {
  name?: string;
  role?: Role;
  phone?: string | null;
  isActive?: boolean;
  password?: string;
}

/**
 * Update a staff member within the tenant. The OWNER account is protected: its
 * role cannot be changed and it cannot be deactivated here.
 */
export async function updateStaff(
  restaurantId: string,
  userId: string,
  patch: UpdateStaffInput
): Promise<StaffResult> {
  const target = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "Staff member not found" };

  const isOwner = target.role === "OWNER";
  if (isOwner && (patch.role !== undefined || patch.isActive === false)) {
    return { ok: false, error: "The owner account cannot be changed here" };
  }
  if (patch.role !== undefined && !isAssignableRole(patch.role)) {
    return { ok: false, error: "Invalid role" };
  }
  if (patch.password !== undefined && patch.password.length > 0 && patch.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.role !== undefined && !isOwner) data.role = patch.role;
  if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
  if (patch.isActive !== undefined && !isOwner) data.isActive = patch.isActive;
  if (patch.password) data.passwordHash = await bcrypt.hash(patch.password, 10);

  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update" };

  await prisma.user.update({ where: { id: target.id }, data });
  return { ok: true, userId: target.id };
}

/** Remove a staff member. The OWNER account cannot be deleted. */
export async function deleteStaff(restaurantId: string, userId: string): Promise<StaffResult> {
  const target = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "Staff member not found" };
  if (target.role === "OWNER") return { ok: false, error: "The owner account cannot be removed" };

  await prisma.user.delete({ where: { id: target.id } });
  return { ok: true, userId: target.id };
}
