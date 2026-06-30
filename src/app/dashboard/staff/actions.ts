"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/staff/permissions";
import { createStaff, updateStaff, deleteStaff } from "@/lib/staff/staff";
import { clockIn, clockOut } from "@/lib/staff/attendance";
import { createShift, updateShift, deleteShift } from "@/lib/staff/shifts";

const roleEnum = z.enum(["MANAGER", "CASHIER", "KITCHEN", "WAITER", "DELIVERY", "STAFF"]);

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: roleEnum,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

/** Create a staff member. Requires the `staff:manage` permission. */
export async function createStaffMember(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "staff:manage")) return actionError("You don't have permission to manage staff");

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const res = await createStaff(restaurantId, {
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    role: parsed.data.role,
    phone: parsed.data.phone || null,
  });
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk({ userId: res.userId });
}

const updateStaffSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  role: roleEnum.optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  password: z.string().max(128).optional().or(z.literal("")),
});

/** Update a staff member. Requires the `staff:manage` permission. */
export async function updateStaffMember(input: unknown): Promise<ActionResult> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "staff:manage")) return actionError("You don't have permission to manage staff");

  const parsed = updateStaffSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const { userId, ...patch } = parsed.data;

  const res = await updateStaff(restaurantId, userId, {
    name: patch.name,
    role: patch.role,
    phone: patch.phone === undefined ? undefined : patch.phone || null,
    isActive: patch.isActive,
    password: patch.password || undefined,
  });
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk();
}

/** Remove a staff member. Requires the `staff:manage` permission. */
export async function deleteStaffMember(input: unknown): Promise<ActionResult> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "staff:manage")) return actionError("You don't have permission to manage staff");

  const parsed = z.object({ userId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await deleteStaff(restaurantId, parsed.data.userId);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk();
}

/** Clock the current user in or out. Every role may clock itself in/out. */
export async function clockInOut(action: unknown): Promise<ActionResult<{ workedMins?: number }>> {
  const { restaurantId, userId, role } = await requireTenant();
  if (!can(role, "attendance:self")) return actionError("Not allowed");

  const parsed = z.enum(["in", "out"]).safeParse(action);
  if (!parsed.success) return actionError("Invalid request");

  const res = parsed.data === "in" ? await clockIn(restaurantId, userId) : await clockOut(restaurantId, userId);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk({ workedMins: res.workedMins });
}

const createShiftSchema = z.object({
  userId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  position: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Schedule a shift. Requires the `shifts:manage` permission. */
export async function createShiftAction(input: unknown): Promise<ActionResult<{ shiftId: string }>> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "shifts:manage")) return actionError("You don't have permission to schedule shifts");

  const parsed = createShiftSchema.safeParse(input);
  if (!parsed.success) return actionError("Please provide a valid shift");

  const res = await createShift(restaurantId, {
    userId: parsed.data.userId,
    startAt: parsed.data.startAt,
    endAt: parsed.data.endAt,
    position: parsed.data.position || null,
    note: parsed.data.note || null,
  });
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk({ shiftId: res.shiftId });
}

const updateShiftSchema = z.object({
  shiftId: z.string().min(1),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  position: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Update a scheduled shift. Requires the `shifts:manage` permission. */
export async function updateShiftAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "shifts:manage")) return actionError("You don't have permission to schedule shifts");

  const parsed = updateShiftSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const { shiftId, ...patch } = parsed.data;

  const res = await updateShift(restaurantId, shiftId, {
    startAt: patch.startAt,
    endAt: patch.endAt,
    position: patch.position === undefined ? undefined : patch.position || null,
    note: patch.note === undefined ? undefined : patch.note || null,
  });
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk();
}

/** Delete a scheduled shift. Requires the `shifts:manage` permission. */
export async function deleteShiftAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, role } = await requireTenant();
  if (!can(role, "shifts:manage")) return actionError("You don't have permission to schedule shifts");

  const parsed = z.object({ shiftId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await deleteShift(restaurantId, parsed.data.shiftId);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/staff");
  return actionOk();
}
