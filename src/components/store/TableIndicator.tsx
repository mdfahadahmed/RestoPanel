"use client";

import { useSearchParams } from "next/navigation";
import { Utensils } from "lucide-react";

/**
 * Shows a "you're at table N" banner when the storefront is opened from a Table
 * QR (which redirects to /r/<slug>?table=N).
 */
export function TableIndicator() {
  const params = useSearchParams();
  const table = params.get("table");
  if (!table) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-violet-500/15 px-4 py-2 text-center text-sm text-violet-100">
      <Utensils className="h-4 w-4" />
      <span>
        You&apos;re seated at <strong>Table {table}</strong> — browse the menu and order below.
      </span>
    </div>
  );
}
