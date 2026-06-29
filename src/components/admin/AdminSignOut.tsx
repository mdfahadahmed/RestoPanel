"use client";

import { useTransition } from "react";
import { adminSignOut } from "@/app/admin/actions";

export function AdminSignOut() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => adminSignOut())}
      disabled={pending}
      className="rounded-lg border border-line bg-ink-850 px-3 py-1.5 text-xs font-medium text-fog-300 transition hover:border-fog-500 hover:text-fog-100 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
