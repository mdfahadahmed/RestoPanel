/**
 * Reservation availability engine — pure functions only (no DB, no framework)
 * so the booking rules are fully unit-testable. Times are handled as "minutes
 * since midnight" in the restaurant's local day; callers pass plain data.
 */

export interface OpenWindow {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type OpeningHours = Partial<Record<WeekdayKey, OpenWindow[]>>;

export interface AvailabilitySettings {
  enabled: boolean;
  slotMinutes: number;
  durationMins: number;
  minPartySize: number;
  maxPartySize: number;
  capacityPerSlot: number | null;
  leadTimeHours: number;
  horizonDays: number;
  openingHours: OpeningHours;
}

export interface TableInfo {
  id: string;
  capacity: number;
  isActive: boolean;
}

export interface ExistingReservation {
  /** Start time, minutes since midnight (on the queried date). */
  startMinutes: number;
  durationMins: number;
  tableId: string | null;
  partySize: number;
  /** Reservation status; absent = treated as active. */
  status?: string;
}

export const WEEKDAYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayKey(date: Date): WeekdayKey {
  return WEEKDAYS[date.getDay()];
}

/** "HH:MM" → minutes since midnight, or null if malformed. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Slot start times (as "HH:MM") for a set of open windows. */
export function slotsForWindows(windows: OpenWindow[], slotMinutes: number): string[] {
  if (slotMinutes <= 0) return [];
  const out: string[] = [];
  const seen = new Set<number>();
  for (const w of windows) {
    const start = parseTime(w.open);
    const end = parseTime(w.close);
    if (start == null || end == null || end <= start) continue;
    // Last bookable start is one slot before close.
    for (let t = start; t <= end - slotMinutes; t += slotMinutes) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(formatTime(t));
      }
    }
  }
  return out.sort();
}

/** YYYY-MM-DD for a date in local time. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * All bookable slot times for a given calendar date, honouring opening hours,
 * the booking horizon and the minimum lead time (relative to `now`).
 */
export function slotsForDate(
  settings: AvailabilitySettings,
  dateStr: string,
  now: Date = new Date()
): string[] {
  if (!settings.enabled) return [];

  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return [];
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);

  // Horizon: date must be within [today, today + horizonDays].
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizonEnd = new Date(todayStart.getTime() + settings.horizonDays * 86_400_000);
  if (dayStart < todayStart || dayStart > horizonEnd) return [];

  const windows = settings.openingHours[weekdayKey(dayStart)] ?? [];
  const all = slotsForWindows(windows, settings.slotMinutes);

  const leadCutoff = now.getTime() + settings.leadTimeHours * 3_600_000;
  return all.filter((t) => {
    const mins = parseTime(t)!;
    const slotTime = new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60).getTime();
    return slotTime >= leadCutoff;
  });
}

/** Do two [start, start+duration) intervals overlap? */
export function intervalsOverlap(
  startA: number,
  durA: number,
  startB: number,
  durB: number
): boolean {
  return startA < startB + durB && startB < startA + durA;
}

export const ACTIVE_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "SEATED"];
const ACTIVE_SET = new Set(ACTIVE_RESERVATION_STATUSES);

export function isActiveReservation(r: ExistingReservation): boolean {
  return r.status == null || ACTIVE_SET.has(r.status);
}

export interface AvailabilityQuery {
  startMinutes: number;
  durationMins: number;
  partySize: number;
}

/**
 * Tables that can seat `partySize` and are free for the requested interval.
 * Smallest sufficient table first (so big tables stay open for big parties).
 * Only active reservations are considered as occupying a table.
 */
export function availableTables(
  query: AvailabilityQuery,
  tables: TableInfo[],
  reservations: ExistingReservation[]
): TableInfo[] {
  const busyByTable = new Set<string>();
  for (const r of reservations) {
    if (!r.tableId || !isActiveReservation(r)) continue;
    if (intervalsOverlap(query.startMinutes, query.durationMins, r.startMinutes, r.durationMins)) {
      busyByTable.add(r.tableId);
    }
  }
  return tables
    .filter((t) => t.isActive && t.capacity >= query.partySize && !busyByTable.has(t.id))
    .sort((a, b) => a.capacity - b.capacity);
}

export interface SlotAvailability {
  time: string;
  available: boolean;
  /** Free tables count (when tables are defined). */
  tablesFree?: number;
  /** Remaining covers (when capacity-per-slot is used instead of tables). */
  seatsLeft?: number;
}

/**
 * Compute availability for every slot on a date for a given party size. When
 * tables exist, availability is table-based; otherwise it falls back to
 * `capacityPerSlot` (null = unlimited).
 */
export function computeDayAvailability(input: {
  settings: AvailabilitySettings;
  dateStr: string;
  partySize: number;
  tables: TableInfo[];
  reservations: ExistingReservation[];
  now?: Date;
}): SlotAvailability[] {
  const { settings, dateStr, partySize, tables, reservations } = input;
  const now = input.now ?? new Date();
  const slots = slotsForDate(settings, dateStr, now);
  const activeTables = tables.filter((t) => t.isActive);
  const usingTables = activeTables.length > 0;

  const active = reservations.filter(isActiveReservation);

  return slots.map((time) => {
    const startMinutes = parseTime(time)!;

    if (usingTables) {
      const free = availableTables({ startMinutes, durationMins: settings.durationMins, partySize }, activeTables, active);
      return { time, available: free.length > 0, tablesFree: free.length };
    }

    // No tables → seat-capacity model.
    if (settings.capacityPerSlot == null) {
      return { time, available: partySize <= settings.maxPartySize };
    }
    const booked = active
      .filter((r) => intervalsOverlap(startMinutes, settings.durationMins, r.startMinutes, r.durationMins))
      .reduce((sum, r) => sum + r.partySize, 0);
    const seatsLeft = Math.max(0, settings.capacityPerSlot - booked);
    return { time, available: seatsLeft >= partySize, seatsLeft };
  });
}

export interface BookingValidation {
  ok: boolean;
  error?: string;
  startMinutes?: number;
}

/** Validate a requested date+time+party against the settings (not table state). */
export function validateBookingRequest(input: {
  settings: AvailabilitySettings;
  dateStr: string;
  time: string;
  partySize: number;
  now?: Date;
}): BookingValidation {
  const { settings, dateStr, time, partySize } = input;
  const now = input.now ?? new Date();

  if (!settings.enabled) return { ok: false, error: "Reservations are not currently available" };
  if (partySize < settings.minPartySize) return { ok: false, error: `Minimum party size is ${settings.minPartySize}` };
  if (partySize > settings.maxPartySize) return { ok: false, error: `Maximum party size is ${settings.maxPartySize}` };

  const startMinutes = parseTime(time);
  if (startMinutes == null) return { ok: false, error: "Invalid time" };

  const slots = slotsForDate(settings, dateStr, now);
  if (!slots.includes(time)) {
    return { ok: false, error: "That time isn't available. Please pick an offered slot." };
  }
  return { ok: true, startMinutes };
}
