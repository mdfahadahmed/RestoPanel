"use client";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { OpeningHoursValue } from "@/lib/validations/settings";

const DAYS: { key: keyof OpeningHoursValue; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHoursValue;
  onChange: (next: OpeningHoursValue) => void;
}) {
  function setDay(key: keyof OpeningHoursValue, slot: { open: string; close: string } | null) {
    onChange({ ...value, [key]: slot });
  }

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const slot = value[key];
        const isOpen = slot !== null;
        return (
          <div key={key} className="flex flex-col gap-2 rounded-xl border border-line bg-ink-850 p-3 sm:flex-row sm:items-center">
            <div className="flex w-40 items-center gap-2">
              <Switch
                checked={isOpen}
                onCheckedChange={(v) => setDay(key, v ? { open: "09:00", close: "22:00" } : null)}
                aria-label={`${label} open`}
              />
              <span className="text-sm font-medium text-fog-200">{label}</span>
            </div>
            {isOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={slot.open}
                  onChange={(e) => setDay(key, { open: e.target.value, close: slot.close })}
                  className="h-9 w-32"
                  aria-label={`${label} opening time`}
                />
                <span className="text-fog-500">–</span>
                <Input
                  type="time"
                  value={slot.close}
                  onChange={(e) => setDay(key, { open: slot.open, close: e.target.value })}
                  className="h-9 w-32"
                  aria-label={`${label} closing time`}
                />
              </div>
            ) : (
              <span className="text-sm text-fog-500">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
