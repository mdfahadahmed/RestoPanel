import { requireTenant } from "@/lib/tenant";
import { can } from "@/lib/staff/permissions";
import { listStaff } from "@/lib/staff/staff";
import { getOpenAttendance, listAttendance } from "@/lib/staff/attendance";
import { listShifts } from "@/lib/staff/shifts";
import { StaffBoard, type StaffMember, type ShiftRow, type AttendanceRow } from "./StaffBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { restaurantId, userId, role } = await requireTenant();
  const canManage = can(role, "staff:manage");
  const canSchedule = can(role, "shifts:manage");
  const canSeeAttendance = can(role, "attendance:manage");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const [myOpen, staff, shifts, attendance, myShifts] = await Promise.all([
    getOpenAttendance(restaurantId, userId),
    canManage ? listStaff(restaurantId) : Promise.resolve([]),
    canSchedule ? listShifts(restaurantId, { from }) : Promise.resolve([]),
    canSeeAttendance ? listAttendance(restaurantId, { from: startOfToday }) : Promise.resolve([]),
    listShifts(restaurantId, { userId, from }),
  ]);

  const staffRows: StaffMember[] = staff.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
  }));
  const shiftRows: ShiftRow[] = shifts.map(toShiftRow);
  const myShiftRows: ShiftRow[] = myShifts.map(toShiftRow);
  const attendanceRows: AttendanceRow[] = attendance.map((a) => ({
    id: a.id,
    userName: a.user.name,
    userRole: a.user.role,
    clockInAt: a.clockInAt.toISOString(),
    clockOutAt: a.clockOutAt ? a.clockOutAt.toISOString() : null,
    workedMins: a.workedMins,
  }));

  return (
    <StaffBoard
      role={role}
      canManage={canManage}
      canSchedule={canSchedule}
      canSeeAttendance={canSeeAttendance}
      myOpenSince={myOpen ? myOpen.clockInAt.toISOString() : null}
      staff={staffRows}
      shifts={shiftRows}
      myShifts={myShiftRows}
      attendance={attendanceRows}
    />
  );
}

function toShiftRow(s: {
  id: string;
  startAt: Date;
  endAt: Date;
  position: string | null;
  note: string | null;
  user: { id: string; name: string; role: string };
}): ShiftRow {
  return {
    id: s.id,
    userId: s.user.id,
    userName: s.user.name,
    userRole: s.user.role,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    position: s.position,
    note: s.note,
  };
}
