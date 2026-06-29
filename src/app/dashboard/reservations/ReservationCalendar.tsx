"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month calendar with a per-day reservation count; clicking a day filters the list. */
export function ReservationCalendar({
  year,
  month, // 1-indexed
  counts,
  selectedDate,
}: {
  year: number;
  month: number;
  counts: Record<string, number>;
  selectedDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(y: number, m: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("year", String(y)); sp.set("month", String(m)); sp.delete("date"); sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }
  function pickDay(key: string) {
    const sp = new URLSearchParams(params.toString());
    if (selectedDate === key) sp.delete("date");
    else sp.set("date", key);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
        <div className="flex items-center gap-1">
          <button onClick={() => go(prev.y, prev.m)} className="rounded-lg border border-line p-1.5 text-fog-400 hover:text-fog-100" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => go(next.y, next.m)} className="rounded-lg border border-line p-1.5 text-fog-400 hover:text-fog-100" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DOW.map((d) => <div key={d} className="py-1 text-[11px] font-medium text-fog-500">{d}</div>)}
          {cells.map((d, i) => {
            if (d == null) return <div key={`e${i}`} />;
            const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const count = counts[key] ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                onClick={() => pickDay(key)}
                className={cn(
                  "aspect-square rounded-lg border p-1 text-sm transition",
                  isSelected ? "border-violet-500 bg-violet-500/15 text-fog-100"
                    : isToday ? "border-gold-400/40 bg-gold-400/5 text-fog-100"
                    : "border-line bg-ink-900/40 text-fog-300 hover:border-fog-600"
                )}
              >
                <div>{d}</div>
                {count > 0 && (
                  <div className="mx-auto mt-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-500/20 px-1 text-[10px] font-medium text-violet-200">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
