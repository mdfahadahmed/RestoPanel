import { z } from "zod";

const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const dashboardReservationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().min(3, "Phone is required").max(40),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  date: dateStr,
  time: timeStr,
  partySize: z.coerce.number().int().min(1).max(50),
  tableId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
});

export const rescheduleSchema = z.object({
  id: z.string().min(1),
  date: dateStr,
  time: timeStr,
  partySize: z.coerce.number().int().min(1).max(50).optional(),
  tableId: z.string().optional().or(z.literal("")),
});

export const tableSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  capacity: z.coerce.number().int().min(1).max(50),
  location: z.string().trim().max(60).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
});

const windowSchema = z.object({ open: timeStr, close: timeStr });

export const reservationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  slotMinutes: z.coerce.number().int().min(5).max(240).default(30),
  durationMins: z.coerce.number().int().min(15).max(480).default(90),
  minPartySize: z.coerce.number().int().min(1).max(50).default(1),
  maxPartySize: z.coerce.number().int().min(1).max(100).default(12),
  capacityPerSlot: z.coerce.number().int().min(0).max(10000).nullable().optional(),
  leadTimeHours: z.coerce.number().int().min(0).max(720).default(2),
  horizonDays: z.coerce.number().int().min(1).max(365).default(60),
  requireApproval: z.boolean().default(true),
  openingHours: z.record(z.string(), z.array(windowSchema)).default({}),
});

export type ReservationSettingsInput = z.infer<typeof reservationSettingsSchema>;
