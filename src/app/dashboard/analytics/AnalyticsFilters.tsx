"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export function AnalyticsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "7d";

  function setRange(range: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", range);
    if (range !== "custom") {
      sp.delete("from");
      sp.delete("to");
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function setCustom(key: "from" | "to", value: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", "custom");
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-line bg-ink-900/50 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setRange(p.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition",
              current === p.value ? "bg-ink-800 text-fog-100" : "text-fog-400 hover:text-fog-100"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date"
          className="h-9 w-[9.5rem]"
          value={params.get("from") ?? ""}
          onChange={(e) => setCustom("from", e.target.value)}
        />
        <span className="text-xs text-fog-500">→</span>
        <Input
          type="date"
          aria-label="To date"
          className="h-9 w-[9.5rem]"
          value={params.get("to") ?? ""}
          onChange={(e) => setCustom("to", e.target.value)}
        />
      </div>
    </div>
  );
}
