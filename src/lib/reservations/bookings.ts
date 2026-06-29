import type { Prisma, ReservationSource, ReservationStatus } from "@prisma/client";
import { Prisma as P } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveSettings, requiresApproval } from "./settings";
import { listActiveTables } from "./tables";
import { generateReservationReference } from "./reference";
import {
  availableTables,
  computeDayAvailability,
  intervalsOverlap,
  isActiveReservation,
  validateBookingRequest,
  type ExistingReservation,
  type SlotAvailability,
} from "./availability";

/** Booking + reservation lifecycle data layer (tenant-scoped). */

function dayBounds(dateStr: string): { start: Date; end: Date } | null {
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function buildStartDate(dateStr: string, time: string): Date | null {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (!y || !mo || !d || h == null || mi == null) return null;
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Active reservations on a date, as availability inputs. */
async function loadDayReservations(
  restaurantId: string,
  dateStr: string,
  excludeId?: string
): Promise<ExistingReservation[]> {
  const bounds = dayBounds(dateStr);
  if (!bounds) return [];
  const rows = await prisma.reservation.findMany({
    where: {
      restaurantId,
      date: { gte: bounds.start, lt: bounds.end },
      status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { date: true, durationMins: true, tableId: true, partySize: true, status: true },
  });
  return rows.map((r) => ({
    startMinutes: minutesIntoDay(r.date),
    durationMins: r.durationMins,
    tableId: r.tableId,
    partySize: r.partySize,
    status: r.status,
  }));
}

export async function getDayAvailability(
  restaurantId: string,
  dateStr: string,
  partySize: number,
  now: Date = new Date()
): Promise<{ slots: SlotAvailability[]; usingTables: boolean }> {
  const [settings, tables, reservations] = await Promise.all([
    getEffectiveSettings(restaurantId),
    listActiveTables(restaurantId),
    loadDayReservations(restaurantId, dateStr),
  ]);
  const slots = computeDayAvailability({
    settings,
    dateStr,
    partySize: Math.max(1, partySize),
    tables: tables.map((t) => ({ id: t.id, capacity: t.capacity, isActive: t.isActive })),
    reservations,
    now,
  });
  return { slots, usingTables: tables.length > 0 };
}

/** Find a free table for an interval (smallest sufficient). */
async function pickTable(
  restaurantId: string,
  dateStr: string,
  startMinutes: number,
  durationMins: number,
  partySize: number,
  excludeId?: string
): Promise<string | null> {
  const tables = await listActiveTables(restaurantId);
  if (tables.length === 0) return null;
  const reservations = await loadDayReservations(restaurantId, dateStr, excludeId);
  const free = availableTables(
    { startMinutes, durationMins, partySize },
    tables.map((t) => ({ id: t.id, capacity: t.capacity, isActive: t.isActive })),
    reservations
  );
  return free[0]?.id ?? null;
}

export interface CreateReservationInput {
  restaurantId: string;
  name: string;
  phone: string;
  email?: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  partySize: number;
  notes?: string | null;
  source?: ReservationSource;
  tableId?: string | null; // explicit (dashboard)
  /** Website bookings enforce slot/lead/horizon; dashboard staff entries may not. */
  enforceSlot?: boolean;
  /** Override the computed status (dashboard). */
  statusOverride?: ReservationStatus;
  now?: Date;
}

export type CreateReservationResult =
  | { ok: true; id: string; reference: string; status: ReservationStatus; tableId: string | null }
  | { ok: false; error: string };

export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const now = input.now ?? new Date();
  const enforceSlot = input.enforceSlot ?? true;
  const settings = await getEffectiveSettings(input.restaurantId);

  const start = buildStartDate(input.date, input.time);
  if (!start) return { ok: false, error: "Invalid date or time" };
  if (start.getTime() < now.getTime() - 60_000) {
    return { ok: false, error: "Pick a future date and time" };
  }
  if (input.partySize < settings.minPartySize) return { ok: false, error: `Minimum party size is ${settings.minPartySize}` };
  if (input.partySize > settings.maxPartySize) return { ok: false, error: `Maximum party size is ${settings.maxPartySize}` };

  if (enforceSlot) {
    const v = validateBookingRequest({ settings, dateStr: input.date, time: input.time, partySize: input.partySize, now });
    if (!v.ok) return { ok: false, error: v.error! };
  }

  const startMinutes = minutesIntoDay(start);

  // Table resolution.
  let tableId: string | null = null;
  const activeTables = await listActiveTables(input.restaurantId);
  if (input.tableId) {
    const table = activeTables.find((t) => t.id === input.tableId);
    if (!table) return { ok: false, error: "Selected table was not found" };
    if (table.capacity < input.partySize) return { ok: false, error: "That table is too small for the party" };
    const dayRes = await loadDayReservations(input.restaurantId, input.date);
    const free = availableTables(
      { startMinutes, durationMins: settings.durationMins, partySize: input.partySize },
      [{ id: table.id, capacity: table.capacity, isActive: table.isActive }],
      dayRes
    );
    if (free.length === 0) return { ok: false, error: "That table is already booked at that time" };
    tableId = table.id;
  } else if (activeTables.length > 0) {
    tableId = await pickTable(input.restaurantId, input.date, startMinutes, settings.durationMins, input.partySize);
    if (!tableId) return { ok: false, error: "No tables are available at that time" };
  } else if (settings.capacityPerSlot != null) {
    // Seat-capacity model (no tables defined).
    const dayRes = await loadDayReservations(input.restaurantId, input.date);
    const booked = dayRes
      .filter((r) => isActiveReservation(r) && intervalsOverlap(startMinutes, settings.durationMins, r.startMinutes, r.durationMins))
      .reduce((s, r) => s + r.partySize, 0);
    if (booked + input.partySize > settings.capacityPerSlot) {
      return { ok: false, error: "We're fully booked at that time" };
    }
  }

  const status: ReservationStatus =
    input.statusOverride ?? ((await requiresApproval(input.restaurantId)) ? "PENDING" : "CONFIRMED");

  // Create with a unique reference (retry on collision).
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const created = await prisma.reservation.create({
        data: {
          restaurantId: input.restaurantId,
          tableId,
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          date: start,
          durationMins: settings.durationMins,
          partySize: input.partySize,
          notes: input.notes || null,
          status,
          source: input.source ?? "WEBSITE",
          reference: generateReservationReference(),
        },
        select: { id: true, reference: true, status: true, tableId: true },
      });
      return { ok: true, id: created.id, reference: created.reference!, status: created.status, tableId: created.tableId };
    } catch (e) {
      if (e instanceof P.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 5) continue;
      throw e;
    }
  }
  return { ok: false, error: "Could not create the reservation, please try again" };
}

// --- Listing / history -----------------------------------------------------
export interface ListFilters {
  status?: ReservationStatus | "ALL";
  scope?: "upcoming" | "history" | "all";
  search?: string;
  date?: string; // YYYY-MM-DD single-day filter (overrides scope)
  page?: number;
  perPage?: number;
  now?: Date;
}

export async function listReservations(restaurantId: string, filters: ListFilters = {}) {
  const { status = "ALL", scope = "all", search, date, page = 1, perPage = 20, now = new Date() } = filters;
  const where: Prisma.ReservationWhereInput = { restaurantId };
  if (status !== "ALL") where.status = status;
  const dayBoundsForFilter = date ? dayBounds(date) : null;
  if (dayBoundsForFilter) where.date = { gte: dayBoundsForFilter.start, lt: dayBoundsForFilter.end };
  else if (scope === "upcoming") where.date = { gte: now };
  else if (scope === "history") where.date = { lt: now };
  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
      { reference: { contains: s.toUpperCase() } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      orderBy: { date: scope === "history" ? "desc" : "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { table: { select: { name: true, capacity: true } } },
    }),
  ]);
  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getReservation(restaurantId: string, id: string) {
  return prisma.reservation.findFirst({
    where: { id, restaurantId },
    include: { table: true },
  });
}

export async function getReservationStats(restaurantId: string, now: Date = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const [today, pending, upcoming, seated] = await Promise.all([
    prisma.reservation.count({ where: { restaurantId, date: { gte: todayStart, lt: todayEnd }, status: { notIn: ["CANCELLED", "REJECTED"] } } }),
    prisma.reservation.count({ where: { restaurantId, status: "PENDING" } }),
    prisma.reservation.count({ where: { restaurantId, date: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.reservation.count({ where: { restaurantId, status: "SEATED" } }),
  ]);
  return { today, pending, upcoming, seated };
}

/** Reservation counts per day for a calendar month (1-indexed month). */
export async function getCalendarCounts(restaurantId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const rows = await prisma.reservation.findMany({
    where: { restaurantId, date: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: { date: true, status: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}-${String(r.date.getDate()).padStart(2, "0")}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// --- Lifecycle -------------------------------------------------------------
async function findOwned(restaurantId: string, id: string) {
  return prisma.reservation.findFirst({ where: { id, restaurantId } });
}

export async function approveReservation(restaurantId: string, id: string, tableId?: string | null) {
  const r = await findOwned(restaurantId, id);
  if (!r) return null;

  // Auto-assign a free table if none chosen and tables exist.
  let assigned = tableId ?? r.tableId;
  if (!assigned) {
    const dateStr = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}-${String(r.date.getDate()).padStart(2, "0")}`;
    assigned = await pickTable(restaurantId, dateStr, minutesIntoDay(r.date), r.durationMins, r.partySize, r.id);
  }

  return prisma.reservation.update({
    where: { id: r.id },
    data: { status: "CONFIRMED", tableId: assigned },
  });
}

export async function rejectReservation(restaurantId: string, id: string) {
  const r = await findOwned(restaurantId, id);
  if (!r) return null;
  return prisma.reservation.update({ where: { id: r.id }, data: { status: "REJECTED", tableId: null } });
}

export async function setReservationStatus(
  restaurantId: string,
  id: string,
  status: Extract<ReservationStatus, "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED">
) {
  const r = await findOwned(restaurantId, id);
  if (!r) return null;
  return prisma.reservation.update({ where: { id: r.id }, data: { status } });
}

export interface RescheduleInput {
  date: string;
  time: string;
  partySize?: number;
  tableId?: string | null;
  enforceSlot?: boolean;
  now?: Date;
}

export async function rescheduleReservation(
  restaurantId: string,
  id: string,
  input: RescheduleInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const r = await findOwned(restaurantId, id);
  if (!r) return { ok: false, error: "Reservation not found" };

  const now = input.now ?? new Date();
  const settings = await getEffectiveSettings(restaurantId);
  const partySize = input.partySize ?? r.partySize;
  const start = buildStartDate(input.date, input.time);
  if (!start) return { ok: false, error: "Invalid date or time" };
  if (start.getTime() < now.getTime() - 60_000) return { ok: false, error: "Pick a future date and time" };

  if (input.enforceSlot ?? false) {
    const v = validateBookingRequest({ settings, dateStr: input.date, time: input.time, partySize, now });
    if (!v.ok) return { ok: false, error: v.error! };
  }

  const startMinutes = minutesIntoDay(start);
  // Re-resolve the table (keeping the current one if still free), excluding self.
  let tableId: string | null = input.tableId !== undefined ? input.tableId : r.tableId;
  const activeTables = await listActiveTables(restaurantId);
  if (activeTables.length > 0) {
    const dayRes = await loadDayReservations(restaurantId, input.date, r.id);
    const candidate = tableId ? activeTables.find((t) => t.id === tableId) : undefined;
    const stillFree =
      candidate &&
      candidate.capacity >= partySize &&
      availableTables({ startMinutes, durationMins: settings.durationMins, partySize }, [{ id: candidate.id, capacity: candidate.capacity, isActive: candidate.isActive }], dayRes).length > 0;
    if (!stillFree) {
      tableId = await pickTable(restaurantId, input.date, startMinutes, settings.durationMins, partySize, r.id);
      if (!tableId) return { ok: false, error: "No tables are available at the new time" };
    }
  }

  await prisma.reservation.update({
    where: { id: r.id },
    data: { date: start, partySize, tableId, durationMins: settings.durationMins },
  });
  return { ok: true, id: r.id };
}
