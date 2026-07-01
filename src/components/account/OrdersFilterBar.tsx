"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_META } from "@/app/dashboard/orders/status";

const SORTS: { value: string; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "total_desc", label: "Total: high → low" },
  { value: "total_asc", label: "Total: low → high" },
];

export function OrdersFilterBar({
  restaurants,
}: {
  restaurants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  // Build a new query string, resetting to page 1 whenever a filter changes.
  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    router.push(`/account/orders?${sp.toString()}`);
  }

  // Debounce the free-text search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) push({ q });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectCls =
    "rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-sm text-fog-200 outline-none transition focus:border-violet-500/60";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order # or item…"
          aria-label="Search orders"
          className="w-full rounded-xl border border-line bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60"
        />
      </div>

      <select
        aria-label="Filter by status"
        className={selectCls}
        value={params.get("status") ?? "ALL"}
        onChange={(e) => push({ status: e.target.value === "ALL" ? "" : e.target.value })}
      >
        <option value="ALL">All statuses</option>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_META[s].label}
          </option>
        ))}
      </select>

      {restaurants.length > 0 && (
        <select
          aria-label="Filter by restaurant"
          className={selectCls}
          value={params.get("restaurantId") ?? "ALL"}
          onChange={(e) =>
            push({ restaurantId: e.target.value === "ALL" ? "" : e.target.value })
          }
        >
          <option value="ALL">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Sort orders"
        className={selectCls}
        value={params.get("sort") ?? "date_desc"}
        onChange={(e) => push({ sort: e.target.value })}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
