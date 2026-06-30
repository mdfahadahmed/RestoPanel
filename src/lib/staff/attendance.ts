import { prisma } from "@/lib/prisma";
import { workedMinutes } from "@/lib/staff/shared";

/** The user's currently open attendance record (clocked in), if any. */
export async function getOpenAttendance(restaurantId: string, userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { restaurantId, userId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
}

export type AttendanceResult =
  | { ok: true; recordId: string; workedMins?: number }
  | { ok: false; error: string };

/** Clock a staff member in. Fails if they already have an open record. */
export async function clockIn(restaurantId: string, userId: string): Promise<AttendanceResult> {
  const open = await getOpenAttendance(restaurantId, userId);
  if (open) return { ok: false, error: "Already clocked in" };

  const record = await prisma.attendanceRecord.create({
    data: { restaurantId, userId },
    select: { id: true },
  });
  return { ok: true, recordId: record.id };
}

/** Clock a staff member out, stamping the worked minutes. */
export async function clockOut(restaurantId: string, userId: string): Promise<AttendanceResult> {
  const open = await getOpenAttendance(restaurantId, userId);
  if (!open) return { ok: false, error: "Not clocked in" };

  const clockOutAt = new Date();
  const mins = workedMinutes(open.clockInAt, clockOutAt);
  await prisma.attendanceRecord.update({
    where: { id: open.id },
    data: { clockOutAt, workedMins: mins },
  });
  return { ok: true, recordId: open.id, workedMins: mins };
}

/** Attendance records for a tenant (optionally a single user / from a date). */
export async function listAttendance(
  restaurantId: string,
  opts?: { userId?: string; from?: Date }
) {
  return prisma.attendanceRecord.findMany({
    where: {
      restaurantId,
      ...(opts?.userId ? { userId: opts.userId } : {}),
      ...(opts?.from ? { clockInAt: { gte: opts.from } } : {}),
    },
    orderBy: { clockInAt: "desc" },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}
