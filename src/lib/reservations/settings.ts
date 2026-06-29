import type { ReservationSetting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AvailabilitySettings, OpeningHours } from "./availability";

/**
 * Reservation settings. A restaurant works fine with NO persisted row — the
 * defaults below are applied so existing/seed tenants can still take bookings.
 */

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  mon: [{ open: "11:00", close: "22:30" }],
  tue: [{ open: "11:00", close: "22:30" }],
  wed: [{ open: "11:00", close: "22:30" }],
  thu: [{ open: "11:00", close: "22:30" }],
  fri: [{ open: "11:00", close: "23:00" }],
  sat: [{ open: "11:00", close: "23:00" }],
  sun: [{ open: "11:00", close: "22:00" }],
};

export const DEFAULT_SETTINGS: AvailabilitySettings = {
  enabled: true,
  slotMinutes: 30,
  durationMins: 90,
  minPartySize: 1,
  maxPartySize: 12,
  capacityPerSlot: null,
  leadTimeHours: 2,
  horizonDays: 60,
  openingHours: DEFAULT_OPENING_HOURS,
};

function toAvailability(row: ReservationSetting | null): AvailabilitySettings {
  if (!row) return DEFAULT_SETTINGS;
  const hours = row.openingHours as OpeningHours | null;
  const hasHours = hours && Object.keys(hours).length > 0;
  return {
    enabled: row.enabled,
    slotMinutes: row.slotMinutes,
    durationMins: row.durationMins,
    minPartySize: row.minPartySize,
    maxPartySize: row.maxPartySize,
    capacityPerSlot: row.capacityPerSlot,
    leadTimeHours: row.leadTimeHours,
    horizonDays: row.horizonDays,
    openingHours: hasHours ? (hours as OpeningHours) : DEFAULT_OPENING_HOURS,
  };
}

/** Effective settings (persisted row merged over defaults). Never null. */
export async function getEffectiveSettings(restaurantId: string): Promise<AvailabilitySettings> {
  const row = await prisma.reservationSetting.findUnique({ where: { restaurantId } });
  return toAvailability(row);
}

/** The raw row for the settings UI, creating defaults if missing. */
export async function getOrCreateSettingsRow(restaurantId: string): Promise<ReservationSetting> {
  const existing = await prisma.reservationSetting.findUnique({ where: { restaurantId } });
  if (existing) return existing;
  return prisma.reservationSetting.create({
    data: {
      restaurantId,
      enabled: DEFAULT_SETTINGS.enabled,
      slotMinutes: DEFAULT_SETTINGS.slotMinutes,
      durationMins: DEFAULT_SETTINGS.durationMins,
      minPartySize: DEFAULT_SETTINGS.minPartySize,
      maxPartySize: DEFAULT_SETTINGS.maxPartySize,
      leadTimeHours: DEFAULT_SETTINGS.leadTimeHours,
      horizonDays: DEFAULT_SETTINGS.horizonDays,
      requireApproval: true,
      openingHours: DEFAULT_OPENING_HOURS as object,
    },
  });
}

export interface SaveSettingsInput {
  enabled: boolean;
  slotMinutes: number;
  durationMins: number;
  minPartySize: number;
  maxPartySize: number;
  capacityPerSlot: number | null;
  leadTimeHours: number;
  horizonDays: number;
  requireApproval: boolean;
  openingHours: OpeningHours;
}

export async function saveSettings(restaurantId: string, input: SaveSettingsInput) {
  const data = { ...input, openingHours: input.openingHours as object };
  return prisma.reservationSetting.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
  });
}

/** Whether approval is required (defaults to true when unset). */
export async function requiresApproval(restaurantId: string): Promise<boolean> {
  const row = await prisma.reservationSetting.findUnique({
    where: { restaurantId },
    select: { requireApproval: true },
  });
  return row ? row.requireApproval : true;
}
