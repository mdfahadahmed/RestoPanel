import { prisma } from "@/lib/prisma";

export interface ShiftInput {
  userId: string;
  startAt: Date;
  endAt: Date;
  position?: string | null;
  note?: string | null;
}

export type ShiftResult = { ok: true; shiftId: string } | { ok: false; error: string };

/** Does the user already have a shift overlapping [startAt, endAt)? */
async function hasOverlap(
  restaurantId: string,
  userId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<boolean> {
  const conflict = await prisma.staffShift.findFirst({
    where: {
      restaurantId,
      userId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  return conflict !== null;
}

/** Assign a shift to an active staff member. Rejects overlaps for that member. */
export async function createShift(restaurantId: string, input: ShiftInput): Promise<ShiftResult> {
  if (input.endAt.getTime() <= input.startAt.getTime()) {
    return { ok: false, error: "Shift must end after it starts" };
  }
  const user = await prisma.user.findFirst({
    where: { id: input.userId, restaurantId },
    select: { id: true, isActive: true },
  });
  if (!user) return { ok: false, error: "Staff member not found" };
  if (!user.isActive) return { ok: false, error: "Cannot schedule a deactivated staff member" };

  if (await hasOverlap(restaurantId, input.userId, input.startAt, input.endAt)) {
    return { ok: false, error: "This staff member already has an overlapping shift" };
  }

  const shift = await prisma.staffShift.create({
    data: {
      restaurantId,
      userId: input.userId,
      startAt: input.startAt,
      endAt: input.endAt,
      position: input.position?.trim() || null,
      note: input.note?.trim() || null,
    },
    select: { id: true },
  });
  return { ok: true, shiftId: shift.id };
}

export interface UpdateShiftInput {
  startAt?: Date;
  endAt?: Date;
  position?: string | null;
  note?: string | null;
}

/** Update a shift within the tenant, re-checking time validity and overlaps. */
export async function updateShift(
  restaurantId: string,
  shiftId: string,
  patch: UpdateShiftInput
): Promise<ShiftResult> {
  const shift = await prisma.staffShift.findFirst({
    where: { id: shiftId, restaurantId },
    select: { id: true, userId: true, startAt: true, endAt: true },
  });
  if (!shift) return { ok: false, error: "Shift not found" };

  const startAt = patch.startAt ?? shift.startAt;
  const endAt = patch.endAt ?? shift.endAt;
  if (endAt.getTime() <= startAt.getTime()) {
    return { ok: false, error: "Shift must end after it starts" };
  }
  if (await hasOverlap(restaurantId, shift.userId, startAt, endAt, shift.id)) {
    return { ok: false, error: "This staff member already has an overlapping shift" };
  }

  await prisma.staffShift.update({
    where: { id: shift.id },
    data: {
      startAt,
      endAt,
      ...(patch.position !== undefined ? { position: patch.position?.trim() || null } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
    },
  });
  return { ok: true, shiftId: shift.id };
}

/** Delete a shift within the tenant. */
export async function deleteShift(restaurantId: string, shiftId: string): Promise<ShiftResult> {
  const res = await prisma.staffShift.deleteMany({ where: { id: shiftId, restaurantId } });
  if (res.count === 0) return { ok: false, error: "Shift not found" };
  return { ok: true, shiftId };
}

/** List shifts for a tenant (optionally by user / window), soonest first. */
export async function listShifts(
  restaurantId: string,
  opts?: { userId?: string; from?: Date; to?: Date }
) {
  return prisma.staffShift.findMany({
    where: {
      restaurantId,
      ...(opts?.userId ? { userId: opts.userId } : {}),
      ...(opts?.from || opts?.to
        ? { startAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    orderBy: { startAt: "asc" },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}
