import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireTenant } from "@/lib/tenant";
import { getOrCreateSettingsRow, DEFAULT_OPENING_HOURS } from "@/lib/reservations/settings";
import type { OpeningHours, WeekdayKey } from "@/lib/reservations/availability";
import { ReservationSettingsForm, type SettingsState } from "./ReservationSettingsForm";

export const dynamic = "force-dynamic";

const DAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default async function ReservationSettingsPage() {
  const { restaurantId } = await requireTenant();
  const row = await getOrCreateSettingsRow(restaurantId);

  const raw = (row.openingHours as OpeningHours | null) ?? {};
  const hours = (Object.keys(raw).length > 0 ? raw : DEFAULT_OPENING_HOURS) as OpeningHours;

  const hoursState: SettingsState["hours"] = {};
  for (const key of DAY_KEYS) {
    const windows = hours[key] ?? [];
    const w = windows[0];
    hoursState[key] = w ? { open: w.open, close: w.close, closed: false } : { open: "11:00", close: "22:00", closed: true };
  }

  const initial: SettingsState = {
    enabled: row.enabled,
    requireApproval: row.requireApproval,
    slotMinutes: row.slotMinutes,
    durationMins: row.durationMins,
    minPartySize: row.minPartySize,
    maxPartySize: row.maxPartySize,
    capacityPerSlot: row.capacityPerSlot == null ? "" : String(row.capacityPerSlot),
    leadTimeHours: row.leadTimeHours,
    horizonDays: row.horizonDays,
    hours: hoursState,
  };

  return (
    <>
      <Link href="/dashboard/reservations" className="inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-fog-200">
        <ArrowLeft className="h-4 w-4" /> Back to reservations
      </Link>
      <PageHeader title="Reservation settings" description="Control availability, slots and approval." />
      <ReservationSettingsForm initial={initial} />
    </>
  );
}
