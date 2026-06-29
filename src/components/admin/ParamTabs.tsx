"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface ParamTabsProps {
  paramKey: string;
  options: { label: string; value: string }[];
  /** The value treated as "no filter" (removes the param). */
  defaultValue?: string;
}

/** Link-style tab filter that syncs a single query param and resets paging. */
export function ParamTabs({ paramKey, options, defaultValue = "ALL" }: ParamTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? defaultValue;

  function select(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === defaultValue) sp.delete(paramKey);
    else sp.set(paramKey, value);
    sp.delete("page");
    router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-ink-900/40 p-1">
      {options.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-ink-800 text-fog-100"
                : "text-fog-400 hover:bg-ink-800/60 hover:text-fog-200"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
