"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSettingsAction } from "../actions";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" }, { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" }, { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" }, { key: "sun", label: "Sunday" },
];

export interface SettingsState {
  enabled: boolean;
  requireApproval: boolean;
  slotMinutes: number;
  durationMins: number;
  minPartySize: number;
  maxPartySize: number;
  capacityPerSlot: string; // "" = unlimited
  leadTimeHours: number;
  horizonDays: number;
  hours: Record<string, { open: string; close: string; closed: boolean }>;
}

export function ReservationSettingsForm({ initial }: { initial: SettingsState }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => setS((p) => ({ ...p, [k]: v }));
  const setDay = (key: string, patch: Partial<{ open: string; close: string; closed: boolean }>) =>
    setS((p) => ({ ...p, hours: { ...p.hours, [key]: { ...p.hours[key], ...patch } } }));

  async function save() {
    setPending(true);
    try {
      const openingHours: Record<string, { open: string; close: string }[]> = {};
      for (const { key } of DAYS) {
        const d = s.hours[key];
        openingHours[key] = d.closed ? [] : [{ open: d.open, close: d.close }];
      }
      const res = await saveSettingsAction({
        enabled: s.enabled,
        requireApproval: s.requireApproval,
        slotMinutes: s.slotMinutes,
        durationMins: s.durationMins,
        minPartySize: s.minPartySize,
        maxPartySize: s.maxPartySize,
        capacityPerSlot: s.capacityPerSlot === "" ? null : Number(s.capacityPerSlot),
        leadTimeHours: s.leadTimeHours,
        horizonDays: s.horizonDays,
        openingHours,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Settings saved");
      router.refresh();
    } finally { setPending(false); }
  }

  const num = (k: keyof SettingsState, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" value={s[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
      {hint && <p className="text-[11px] text-fog-500">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5">
            <span className="text-sm"><span className="font-medium text-fog-200">Accept reservations</span><span className="block text-xs text-fog-500">Show the booking form on your website</span></span>
            <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5">
            <span className="text-sm"><span className="font-medium text-fog-200">Require approval</span><span className="block text-xs text-fog-500">New bookings start as Pending until you approve</span></span>
            <Switch checked={s.requireApproval} onCheckedChange={(v) => set("requireApproval", v)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {num("slotMinutes", "Slot interval (min)", "Time between bookable slots")}
            {num("durationMins", "Booking length (min)", "How long a table is held")}
            <div className="space-y-1.5">
              <Label>Covers per slot</Label>
              <Input type="number" value={s.capacityPerSlot} onChange={(e) => set("capacityPerSlot", e.target.value)} placeholder="Unlimited" />
              <p className="text-[11px] text-fog-500">Used only when no tables are defined</p>
            </div>
            {num("minPartySize", "Min party size")}
            {num("maxPartySize", "Max party size")}
            {num("leadTimeHours", "Min notice (hours)")}
            {num("horizonDays", "Book ahead (days)")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Opening hours for reservations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = s.hours[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2">
                <span className="w-24 text-sm text-fog-300">{label}</span>
                <label className="flex items-center gap-2 text-xs text-fog-400">
                  <Switch checked={!d.closed} onCheckedChange={(v) => setDay(key, { closed: !v })} /> Open
                </label>
                {!d.closed && (
                  <div className="flex items-center gap-2">
                    <Input type="time" value={d.open} onChange={(e) => setDay(key, { open: e.target.value })} className="h-9 w-32" />
                    <span className="text-fog-500">–</span>
                    <Input type="time" value={d.close} onChange={(e) => setDay(key, { close: e.target.value })} className="h-9 w-32" />
                  </div>
                )}
                {d.closed && <span className="text-xs text-fog-600">Closed</span>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}
