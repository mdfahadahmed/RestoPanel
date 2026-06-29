"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  createReservation,
  approveReservation,
  rejectReservation,
  rescheduleReservation,
  setReservationStatus,
  getDayAvailability,
} from "@/lib/reservations/bookings";
import { createTable, updateTable, deleteTable } from "@/lib/reservations/tables";
import { saveSettings } from "@/lib/reservations/settings";
import {
  dashboardReservationSchema,
  rescheduleSchema,
  tableSchema,
  reservationSettingsSchema,
} from "@/lib/validations/reservation";
import { notifyReservation, notifyReservationStatus } from "@/lib/notifications/notify";

function revalidate() {
  revalidatePath("/dashboard/reservations");
}

// --- Bookings --------------------------------------------------------------
export async function createReservationAction(input: unknown): Promise<ActionResult<{ reference: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = dashboardReservationSchema.safeParse(input);
  if (!parsed.success) return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const result = await createReservation({
    restaurantId,
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    date: d.date,
    time: d.time,
    partySize: d.partySize,
    notes: d.notes || null,
    tableId: d.tableId || null,
    source: "DASHBOARD",
    enforceSlot: false, // staff can book any time
    statusOverride: d.status,
  });
  if (!result.ok) return actionError(result.error);

  await notifyReservation(result.id).catch(() => undefined);
  revalidate();
  return actionOk({ reference: result.reference });
}

export async function approveReservationAction(id: string, tableId?: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const r = await approveReservation(restaurantId, id, tableId || null);
  if (!r) return actionError("Reservation not found");
  await notifyReservationStatus(id, "RESERVATION_CONFIRMED").catch(() => undefined);
  revalidate();
  return actionOk();
}

export async function rejectReservationAction(id: string, reason?: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const r = await rejectReservation(restaurantId, id);
  if (!r) return actionError("Reservation not found");
  await notifyReservationStatus(id, "RESERVATION_REJECTED", { reason }).catch(() => undefined);
  revalidate();
  return actionOk();
}

export async function rescheduleReservationAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const result = await rescheduleReservation(restaurantId, d.id, {
    date: d.date,
    time: d.time,
    partySize: d.partySize,
    tableId: d.tableId || null,
    enforceSlot: false,
  });
  if (!result.ok) return actionError(result.error);

  await notifyReservationStatus(d.id, "RESERVATION_RESCHEDULED").catch(() => undefined);
  revalidate();
  return actionOk();
}

export async function setStatusAction(
  id: string,
  status: "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED"
): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const r = await setReservationStatus(restaurantId, id, status);
  if (!r) return actionError("Reservation not found");
  revalidate();
  return actionOk();
}

export async function getDayAvailabilityAction(
  date: string,
  partySize: number
): Promise<ActionResult<{ slots: { time: string; available: boolean }[] }>> {
  const { restaurantId } = await requireTenant();
  const { slots } = await getDayAvailability(restaurantId, date, partySize);
  return actionOk({ slots: slots.map((s) => ({ time: s.time, available: s.available })) });
}

// --- Tables ----------------------------------------------------------------
export async function createTableAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  try {
    await createTable(restaurantId, parsed.data);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not create table");
  }
  revalidatePath("/dashboard/reservations/tables");
  return actionOk();
}

export async function updateTableAction(id: string, input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = tableSchema.partial().safeParse(input);
  if (!parsed.success) return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  try {
    const updated = await updateTable(restaurantId, id, parsed.data);
    if (!updated) return actionError("Table not found");
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not update table");
  }
  revalidatePath("/dashboard/reservations/tables");
  return actionOk();
}

export async function deleteTableAction(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const ok = await deleteTable(restaurantId, id);
  if (!ok) return actionError("Table not found");
  revalidatePath("/dashboard/reservations/tables");
  return actionOk();
}

// --- Settings --------------------------------------------------------------
export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = reservationSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  await saveSettings(restaurantId, {
    enabled: d.enabled,
    slotMinutes: d.slotMinutes,
    durationMins: d.durationMins,
    minPartySize: d.minPartySize,
    maxPartySize: d.maxPartySize,
    capacityPerSlot: d.capacityPerSlot ?? null,
    leadTimeHours: d.leadTimeHours,
    horizonDays: d.horizonDays,
    requireApproval: d.requireApproval,
    openingHours: d.openingHours,
  });
  revalidatePath("/dashboard/reservations/settings");
  revalidate();
  return actionOk();
}
