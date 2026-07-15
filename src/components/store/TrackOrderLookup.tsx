"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Public order-tracking entry point. Takes an order number and forwards to the
 * tenant-scoped tracking page, which resolves and displays the live status.
 */
export function TrackOrderLookup({ slug }: { slug: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const orderNumber = value.trim();
    if (!orderNumber) return;
    setSubmitting(true);
    router.push(`/r/${slug}/track/${encodeURIComponent(orderNumber)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 1042"
          aria-label="Order number"
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-ink-900 py-3 pl-10 pr-3 text-sm text-fog-100 placeholder:text-fog-600 focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/40"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !value.trim()}
        className="rounded-xl bg-gold-400 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-300 disabled:opacity-50"
      >
        {submitting ? "Finding…" : "Track order"}
      </button>
    </form>
  );
}
