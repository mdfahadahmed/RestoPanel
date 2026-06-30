/**
 * End-to-end data test for the Staff Management module.
 *
 * Exercises the pure RBAC matrix + time helpers, plus the tenant-scoped Prisma
 * logic behind the server actions: staff CRUD (with owner-account guards and
 * bcrypt hashing), attendance clock in/out with worked-minute stamping, and
 * shift scheduling with overlap/validity rules — including cross-tenant
 * isolation. Cleans up everything it creates.
 *
 * Run: npx tsx scripts/test-staff.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  can,
  isAssignableRole,
  ROLE_PERMISSIONS,
  ASSIGNABLE_ROLES,
} from "../src/lib/staff/permissions";
import {
  workedMinutes,
  shiftDurationMins,
  rangesOverlap,
  formatMinutes,
} from "../src/lib/staff/shared";
import { createStaff, updateStaff, deleteStaff, listStaff } from "../src/lib/staff/staff";
import { clockIn, clockOut, getOpenAttendance, listAttendance } from "../src/lib/staff/attendance";
import { createShift, updateShift, deleteShift, listShifts } from "../src/lib/staff/shifts";

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

async function main() {
  const tag = `__stafftest_${Date.now()}`;
  const tenantA = await prisma.restaurant.create({
    data: {
      slug: `${tag}-a`,
      name: "SA",
      ownerName: "A",
      users: { create: { name: "Owner A", email: `owner-a@${tag}.test`, passwordHash: "x", role: "OWNER" } },
    },
    include: { users: true },
  });
  const tenantB = await prisma.restaurant.create({
    data: {
      slug: `${tag}-b`,
      name: "SB",
      ownerName: "B",
      users: { create: { name: "Owner B", email: `owner-b@${tag}.test`, passwordHash: "x", role: "OWNER" } },
    },
    include: { users: true },
  });
  const ownerA = tenantA.users[0];

  try {
    console.log("\n[1] RBAC matrix");
    check("OWNER can do everything", can("OWNER", "billing:manage") && can("OWNER", "staff:manage"));
    check("MANAGER manages staff, not billing", can("MANAGER", "staff:manage") && !can("MANAGER", "billing:manage"));
    check("MANAGER cannot manage settings", !can("MANAGER", "settings:manage"));
    check("CASHIER uses POS, not staff/kitchen", can("CASHIER", "pos:use") && !can("CASHIER", "staff:manage") && !can("CASHIER", "kitchen:use"));
    check("KITCHEN uses kitchen, not POS", can("KITCHEN", "kitchen:use") && !can("KITCHEN", "pos:use"));
    check("WAITER manages reservations, not deliveries", can("WAITER", "reservations:manage") && !can("WAITER", "deliveries:manage"));
    check("DELIVERY manages deliveries, not POS", can("DELIVERY", "deliveries:manage") && !can("DELIVERY", "pos:use"));
    check("STAFF can view orders, not manage", can("STAFF", "orders:view") && !can("STAFF", "orders:manage"));
    const everyRole = ["OWNER", "MANAGER", "CASHIER", "KITCHEN", "WAITER", "DELIVERY", "STAFF"] as const;
    check("every role can clock in/out", everyRole.every((r) => can(r, "attendance:self")));
    check("every role sees own shifts", everyRole.every((r) => can(r, "shifts:view")));
    check("OWNER not assignable, CASHIER assignable", !isAssignableRole("OWNER") && isAssignableRole("CASHIER"));
    check("ROLE_PERMISSIONS covers assignable roles", ASSIGNABLE_ROLES.every((r) => Array.isArray(ROLE_PERMISSIONS[r])));

    console.log("\n[2] Pure time helpers");
    const t0 = new Date("2026-07-01T09:00:00Z");
    const t90 = new Date("2026-07-01T10:30:00Z");
    check("workedMinutes = 90", workedMinutes(t0, t90) === 90);
    check("workedMinutes never negative", workedMinutes(t90, t0) === 0);
    check("shiftDurationMins = 90", shiftDurationMins(t0, t90) === 90);
    check("overlap detected", rangesOverlap(t0, t90, new Date("2026-07-01T10:00:00Z"), new Date("2026-07-01T11:00:00Z")));
    check("touching edges do not overlap", !rangesOverlap(t0, t90, t90, new Date("2026-07-01T11:00:00Z")));
    check("disjoint do not overlap", !rangesOverlap(t0, t90, new Date("2026-07-01T12:00:00Z"), new Date("2026-07-01T13:00:00Z")));
    check("formatMinutes 95 → 1h 35m", formatMinutes(95) === "1h 35m");
    check("formatMinutes 60 → 1h", formatMinutes(60) === "1h");
    check("formatMinutes 45 → 45m", formatMinutes(45) === "45m");

    console.log("\n[3] Staff CRUD + guards + hashing");
    const created = await createStaff(tenantA.id, {
      name: "Cathy Cashier",
      email: `cashier@${tag}.test`,
      password: "password123",
      role: "CASHIER",
    });
    check("staff created", created.ok, created);
    const cashierId = created.ok ? created.userId : "";
    check("cannot create OWNER", !(await createStaff(tenantA.id, { name: "x", email: `o2@${tag}.test`, password: "password123", role: "OWNER" as never })).ok);
    check("duplicate email rejected", !(await createStaff(tenantA.id, { name: "x", email: `cashier@${tag}.test`, password: "password123", role: "WAITER" })).ok);
    check("short password rejected", !(await createStaff(tenantA.id, { name: "x", email: `short@${tag}.test`, password: "123", role: "WAITER" })).ok);

    const cashierRow = await prisma.user.findUnique({ where: { id: cashierId }, select: { passwordHash: true } });
    check("password is bcrypt-hashed", !!cashierRow && (await bcrypt.compare("password123", cashierRow.passwordHash)));

    const roster = await listStaff(tenantA.id);
    check("roster has owner + cashier", roster.length === 2 && roster.some((u) => u.role === "OWNER"));

    check("update role + deactivate", (await updateStaff(tenantA.id, cashierId, { role: "WAITER", isActive: false })).ok);
    const waiterNow = await prisma.user.findUnique({ where: { id: cashierId }, select: { role: true, isActive: true } });
    check("role changed to WAITER, inactive", waiterNow?.role === "WAITER" && waiterNow?.isActive === false);
    check("owner role cannot change", !(await updateStaff(tenantA.id, ownerA.id, { role: "MANAGER" })).ok);
    check("owner cannot be deactivated", !(await updateStaff(tenantA.id, ownerA.id, { isActive: false })).ok);
    check("owner name CAN be edited", (await updateStaff(tenantA.id, ownerA.id, { name: "Owner A2" })).ok);
    check("owner cannot be deleted", !(await deleteStaff(tenantA.id, ownerA.id)).ok);

    // Reactivate the cashier/waiter for the shift tests.
    await updateStaff(tenantA.id, cashierId, { isActive: true });

    console.log("\n[4] Attendance");
    const ci = await clockIn(tenantA.id, cashierId);
    check("clock in ok", ci.ok);
    check("double clock-in rejected", !(await clockIn(tenantA.id, cashierId)).ok);
    check("open record exists", (await getOpenAttendance(tenantA.id, cashierId)) !== null);
    // Backdate the open record 90 minutes so clock-out stamps a real duration.
    if (ci.ok) {
      await prisma.attendanceRecord.update({
        where: { id: ci.recordId },
        data: { clockInAt: new Date(Date.now() - 90 * 60000) },
      });
    }
    const co = await clockOut(tenantA.id, cashierId);
    check("clock out stamps ~90 min", co.ok && (co as { workedMins?: number }).workedMins! >= 89 && (co as { workedMins?: number }).workedMins! <= 91, co);
    check("no open record after clock-out", (await getOpenAttendance(tenantA.id, cashierId)) === null);
    check("clock out when not in rejected", !(await clockOut(tenantA.id, cashierId)).ok);
    check("attendance listed", (await listAttendance(tenantA.id, { userId: cashierId })).length === 1);

    console.log("\n[5] Shifts + overlap rules");
    const waiter = await createStaff(tenantA.id, { name: "Will Waiter", email: `waiter@${tag}.test`, password: "password123", role: "WAITER" });
    const waiterId = waiter.ok ? waiter.userId : "";
    const base = Date.now() + 24 * 3600_000;
    const at = (h: number) => new Date(base + h * 3600_000);

    const s1 = await createShift(tenantA.id, { userId: cashierId, startAt: at(0), endAt: at(2) });
    check("shift created", s1.ok, s1);
    check("end before start rejected", !(await createShift(tenantA.id, { userId: cashierId, startAt: at(2), endAt: at(1) })).ok);
    check("overlapping shift rejected", !(await createShift(tenantA.id, { userId: cashierId, startAt: at(1), endAt: at(3) })).ok);
    const s3 = await createShift(tenantA.id, { userId: cashierId, startAt: at(2), endAt: at(4) }); // touches s1 end
    check("touching shift allowed", s3.ok, s3);
    check("same slot, different user allowed", (await createShift(tenantA.id, { userId: waiterId, startAt: at(0), endAt: at(2) })).ok);
    check("shift for unknown user rejected", !(await createShift(tenantA.id, { userId: "nope", startAt: at(0), endAt: at(2) })).ok);

    if (s3.ok) {
      check("update into overlap rejected", !(await updateShift(tenantA.id, s3.shiftId, { startAt: at(1) })).ok);
      check("valid update ok", (await updateShift(tenantA.id, s3.shiftId, { startAt: at(5), endAt: at(6), position: "Close" })).ok);
      check("delete shift ok", (await deleteShift(tenantA.id, s3.shiftId)).ok);
      check("delete unknown shift rejected", !(await deleteShift(tenantA.id, s3.shiftId)).ok);
    }

    // Deactivated staff cannot be scheduled.
    await updateStaff(tenantA.id, waiterId, { isActive: false });
    check("deactivated staff cannot be scheduled", !(await createShift(tenantA.id, { userId: waiterId, startAt: at(8), endAt: at(9) })).ok);
    await updateStaff(tenantA.id, waiterId, { isActive: true });

    const shiftList = await listShifts(tenantA.id, {});
    check("shifts listed for tenant", shiftList.length >= 2);

    console.log("\n[6] Tenant isolation");
    check("tenant B cannot update tenant A staff", !(await updateStaff(tenantB.id, cashierId, { name: "Hacked" })).ok);
    check("tenant B cannot delete tenant A staff", !(await deleteStaff(tenantB.id, cashierId)).ok);
    check("tenant B cannot see tenant A open attendance", (await getOpenAttendance(tenantB.id, cashierId)) === null);
    check("tenant B cannot clock out tenant A staff", !(await clockOut(tenantB.id, cashierId)).ok);
    check("tenant B cannot schedule tenant A staff", !(await createShift(tenantB.id, { userId: cashierId, startAt: at(0), endAt: at(2) })).ok);
    check("tenant B staff list excludes tenant A", (await listStaff(tenantB.id)).every((u) => u.id !== cashierId));
    if (s1.ok) {
      check("tenant B cannot update tenant A shift", !(await updateShift(tenantB.id, s1.shiftId, { position: "x" })).ok);
      check("tenant B cannot delete tenant A shift", !(await deleteShift(tenantB.id, s1.shiftId)).ok);
    }
    check("tenant B shifts empty", (await listShifts(tenantB.id, {})).length === 0);
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
