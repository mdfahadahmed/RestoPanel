/**
 * End-to-end tests for the Reservation System: the pure availability engine
 * (slots, table overlap, capacity), settings defaults, table CRUD, booking with
 * auto table assignment, and the approve/reject/reschedule/status lifecycle —
 * plus tenant isolation. Cleans up everything it creates.
 *
 * Run: npx tsx scripts/test-reservations.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  parseTime, formatTime, slotsForWindows, slotsForDate, weekdayKey,
  intervalsOverlap, availableTables, computeDayAvailability, validateBookingRequest,
  type AvailabilitySettings, type OpeningHours,
} from "../src/lib/reservations/availability";
import { getEffectiveSettings, getOrCreateSettingsRow, saveSettings, DEFAULT_SETTINGS } from "../src/lib/reservations/settings";
import { createTable, listActiveTables, updateTable, deleteTable } from "../src/lib/reservations/tables";
import {
  createReservation, listReservations, getReservation, approveReservation,
  rejectReservation, setReservationStatus, rescheduleReservation,
  getCalendarCounts, getReservationStats, getDayAvailability,
} from "../src/lib/reservations/bookings";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

const everyDay = (open: string, close: string): OpeningHours => ({
  mon: [{ open, close }], tue: [{ open, close }], wed: [{ open, close }], thu: [{ open, close }],
  fri: [{ open, close }], sat: [{ open, close }], sun: [{ open, close }],
});

function dayStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const tag = `res${Date.now().toString(36)}`;

  try {
    // ===================================================================== [1]
    console.log("\n[1] Availability engine (pure)");
    check("parseTime/formatTime round-trip", parseTime("19:30") === 1170 && formatTime(1170) === "19:30");
    check("parseTime rejects bad input", parseTime("99:99") === null && parseTime("abc") === null);
    check("weekdayKey", weekdayKey(new Date(2026, 0, 4)) === "sun"); // 2026-01-04 is a Sunday

    const slots = slotsForWindows([{ open: "11:00", close: "13:00" }], 30);
    check("slotsForWindows steps to close-slot", JSON.stringify(slots) === JSON.stringify(["11:00", "11:30", "12:00", "12:30"]), slots);

    const settings: AvailabilitySettings = {
      enabled: true, slotMinutes: 30, durationMins: 90, minPartySize: 1, maxPartySize: 8,
      capacityPerSlot: null, leadTimeHours: 2, horizonDays: 30, openingHours: everyDay("11:00", "22:00"),
    };
    const now = new Date(2026, 5, 1, 10, 0); // Mon 1 Jun 2026, 10:00

    const future = slotsForDate(settings, "2026-06-04", now);
    check("slotsForDate returns slots within window", future.includes("11:00") && future.includes("19:00") && !future.includes("22:00"), future.slice(0, 3));
    check("beyond horizon → no slots", slotsForDate(settings, "2026-09-01", now).length === 0);
    const sameDay = slotsForDate(settings, "2026-06-01", now);
    check("lead time filters early slots", !sameDay.includes("11:00") && sameDay.includes("12:00"), sameDay.slice(0, 2));
    check("disabled → no slots", slotsForDate({ ...settings, enabled: false }, "2026-06-04", now).length === 0);

    check("intervalsOverlap detects overlap", intervalsOverlap(1140, 90, 1200, 90) && !intervalsOverlap(1140, 90, 1230, 90));

    const tables = [
      { id: "t2", capacity: 2, isActive: true },
      { id: "t4", capacity: 4, isActive: true },
      { id: "t6", capacity: 6, isActive: true },
    ];
    const occupied = [{ startMinutes: 1140, durationMins: 90, tableId: "t4", partySize: 4, status: "CONFIRMED" }];
    const freeFor3 = availableTables({ startMinutes: 1140, durationMins: 90, partySize: 3 }, tables, occupied);
    check("availableTables excludes busy + too-small, smallest first", freeFor3.map((t) => t.id).join(",") === "t6", freeFor3.map((t) => t.id));
    const freeFor2 = availableTables({ startMinutes: 1140, durationMins: 90, partySize: 2 }, tables, occupied);
    check("availableTables smallest-sufficient ordering", freeFor2.map((t) => t.id).join(",") === "t2,t6");
    const freeLater = availableTables({ startMinutes: 1230, durationMins: 90, partySize: 4 }, tables, occupied);
    check("non-overlapping slot frees the table", freeLater.some((t) => t.id === "t4"));

    const dayAvail = computeDayAvailability({ settings, dateStr: "2026-06-04", partySize: 4, tables, reservations: occupied, now });
    const slot19 = dayAvail.find((s) => s.time === "19:00");
    check("computeDayAvailability table model", slot19?.available === true && slot19?.tablesFree === 1, slot19);

    const capSettings = { ...settings, capacityPerSlot: 4 };
    const capAvail = computeDayAvailability({ settings: capSettings, dateStr: "2026-06-04", partySize: 3, tables: [], reservations: [{ startMinutes: 1140, durationMins: 90, tableId: null, partySize: 2, status: "CONFIRMED" }], now });
    const capSlot = capAvail.find((s) => s.time === "19:00");
    check("computeDayAvailability seat-capacity model", capSlot?.seatsLeft === 2 && capSlot?.available === false, capSlot);

    check("validateBookingRequest ok for valid slot", validateBookingRequest({ settings, dateStr: "2026-06-04", time: "19:00", partySize: 4, now }).ok);
    check("validateBookingRequest rejects oversized party", !validateBookingRequest({ settings, dateStr: "2026-06-04", time: "19:00", partySize: 20, now }).ok);
    check("validateBookingRequest rejects off-grid time", !validateBookingRequest({ settings, dateStr: "2026-06-04", time: "19:07", partySize: 4, now }).ok);

    // ===================================================================== [2]
    console.log("\n[2] Settings");
    const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "Bella", ownerName: "Sam" } });
    const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "Other", ownerName: "B" } });

    const eff = await getEffectiveSettings(a.id);
    check("defaults apply with no row", eff.enabled === DEFAULT_SETTINGS.enabled && eff.slotMinutes === 30);
    const row = await getOrCreateSettingsRow(a.id);
    check("getOrCreateSettingsRow creates a row", !!row.id && row.requireApproval === true);
    await saveSettings(a.id, {
      enabled: true, slotMinutes: 60, durationMins: 120, minPartySize: 2, maxPartySize: 6,
      capacityPerSlot: null, leadTimeHours: 1, horizonDays: 45, requireApproval: false, openingHours: everyDay("12:00", "21:00"),
    });
    const eff2 = await getEffectiveSettings(a.id);
    check("saved settings take effect", eff2.slotMinutes === 60 && eff2.maxPartySize === 6);

    // Reset to permissive defaults for booking tests (approval required).
    await saveSettings(a.id, {
      enabled: true, slotMinutes: 30, durationMins: 90, minPartySize: 1, maxPartySize: 8,
      capacityPerSlot: null, leadTimeHours: 2, horizonDays: 60, requireApproval: true, openingHours: everyDay("11:00", "23:00"),
    });

    // ===================================================================== [3]
    console.log("\n[3] Tables");
    const t4 = await createTable(a.id, { name: "T4", capacity: 4 });
    const t2 = await createTable(a.id, { name: "T2", capacity: 2 });
    check("tables created + active list sorted by capacity", (await listActiveTables(a.id)).map((t) => t.name).join(",") === "T2,T4");
    let dupErr = "";
    try { await createTable(a.id, { name: "T4", capacity: 8 }); } catch (e) { dupErr = (e as Error).message; }
    check("duplicate table name rejected", dupErr.includes("already exists"));
    await updateTable(a.id, t2.id, { capacity: 3 });
    check("table updated", (await prisma.restaurantTable.findUnique({ where: { id: t2.id } }))?.capacity === 3);

    // ===================================================================== [4]
    console.log("\n[4] Booking + auto table assignment");
    const future3 = dayStr(new Date(Date.now() + 3 * 86_400_000));

    // After [3], T2 has capacity 3 and T4 has capacity 4.
    const r1 = await createReservation({ restaurantId: a.id, name: "Joe", phone: "+4470", date: future3, time: "19:00", partySize: 3 });
    check("booking succeeds, PENDING, has reference", r1.ok && r1.status === "PENDING" && /^R-/.test(r1.reference), r1);
    check("party 3 → smallest sufficient table (T2/cap3)", r1.ok && r1.tableId === t2.id, r1);

    const r2 = await createReservation({ restaurantId: a.id, name: "Mia", phone: "+4471", date: future3, time: "19:00", partySize: 2 });
    check("second booking takes the remaining table (T4)", r2.ok && r2.tableId === t4.id, r2);

    const r3 = await createReservation({ restaurantId: a.id, name: "Sam", phone: "+4472", date: future3, time: "19:00", partySize: 2 });
    check("no tables left at that time → rejected", !r3.ok);

    const r4 = await createReservation({ restaurantId: a.id, name: "Pat", phone: "+4473", date: future3, time: "21:00", partySize: 2 });
    check("different time reuses a table", r4.ok && !!r4.tableId);

    const past = await createReservation({ restaurantId: a.id, name: "X", phone: "+1", date: "2000-01-01", time: "19:00", partySize: 2 });
    check("past date rejected", !past.ok);
    const tooBig = await createReservation({ restaurantId: a.id, name: "X", phone: "+1", date: future3, time: "19:00", partySize: 99 });
    check("oversized party rejected", !tooBig.ok);
    const offGrid = await createReservation({ restaurantId: a.id, name: "X", phone: "+1", date: future3, time: "19:07", partySize: 2, enforceSlot: true });
    check("website off-grid time rejected", !offGrid.ok);
    const staffOffGrid = await createReservation({ restaurantId: a.id, name: "Walk", phone: "+1", date: future3, time: "22:07", partySize: 2, enforceSlot: false, statusOverride: "CONFIRMED", source: "DASHBOARD" });
    check("dashboard off-grid booking allowed + CONFIRMED", staffOffGrid.ok && staffOffGrid.status === "CONFIRMED", staffOffGrid);

    // ===================================================================== [5]
    console.log("\n[5] getDayAvailability reflects bookings");
    const avail = await getDayAvailability(a.id, future3, 2);
    const slot1900 = avail.slots.find((s) => s.time === "19:00");
    check("19:00 unavailable for party 2 (both tables busy)", avail.usingTables && slot1900?.available === false, slot1900);
    const slot1200 = avail.slots.find((s) => s.time === "12:00");
    check("12:00 still available (no bookings)", slot1200?.available === true, slot1200);

    // ===================================================================== [6]
    console.log("\n[6] Lifecycle: approve / reject / reschedule / status");
    // A PENDING reservation with no table (created directly) to exercise auto-assign on approve.
    const manual = await prisma.reservation.create({
      data: { restaurantId: a.id, name: "Lee", phone: "+4474", date: new Date(`${future3}T12:00:00`), durationMins: 90, partySize: 2, status: "PENDING", source: "WEBSITE", reference: `R-${tag.slice(0, 4).toUpperCase()}` },
    });
    const approved = await approveReservation(a.id, manual.id);
    check("approve → CONFIRMED + auto-assigned a table", approved?.status === "CONFIRMED" && !!approved?.tableId);

    const rejected = await rejectReservation(a.id, r4.ok ? r4.id : "");
    check("reject → REJECTED + table released", rejected?.status === "REJECTED" && rejected?.tableId === null);

    const resched = await rescheduleReservation(a.id, r1.ok ? r1.id : "", { date: future3, time: "20:30", partySize: 3 });
    check("reschedule succeeds", resched.ok);
    const r1after = await getReservation(a.id, r1.ok ? r1.id : "");
    check("reschedule moved the time to 20:30", r1after?.date.getHours() === 20 && r1after?.date.getMinutes() === 30);

    const seated = await setReservationStatus(a.id, manual.id, "SEATED");
    check("setStatus → SEATED", seated?.status === "SEATED");
    const completed = await setReservationStatus(a.id, manual.id, "COMPLETED");
    check("setStatus → COMPLETED", completed?.status === "COMPLETED");

    // ===================================================================== [7]
    console.log("\n[7] Listing, history, calendar, stats");
    const upcoming = await listReservations(a.id, { scope: "upcoming", perPage: 100 });
    check("listReservations upcoming scoped to A", upcoming.rows.every((r) => r.restaurantId === a.id) && upcoming.total >= 1);
    const byRef = await listReservations(a.id, { search: r1.ok ? r1.reference : "", perPage: 100 });
    check("search by reference works", byRef.rows.some((r) => r.id === (r1.ok ? r1.id : "")));
    const fd = new Date(`${future3}T00:00:00`);
    const counts = await getCalendarCounts(a.id, fd.getFullYear(), fd.getMonth() + 1);
    check("calendar counts the booking day", (counts[future3] ?? 0) >= 1, counts[future3]);
    const stats = await getReservationStats(a.id);
    check("stats expose pending/upcoming", typeof stats.pending === "number" && typeof stats.upcoming === "number");

    // ===================================================================== [8]
    console.log("\n[8] Tenant isolation");
    check("B cannot approve A's reservation", (await approveReservation(b.id, manual.id)) === null);
    check("B cannot reschedule A's reservation", !(await rescheduleReservation(b.id, manual.id, { date: future3, time: "19:00" })).ok);
    const bList = await listReservations(b.id, { perPage: 100 });
    check("B sees none of A's reservations", bList.total === 0);
    check("deleteTable is tenant-scoped", (await deleteTable(b.id, t4.id)) === false);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades reservations/tables/settings
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
