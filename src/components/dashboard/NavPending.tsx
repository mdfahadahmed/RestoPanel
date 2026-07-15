"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * A tiny spinner that appears on the clicked nav item while its route is being
 * fetched. Must be rendered inside a <Link>. Gives lightweight, targeted
 * feedback (like Linear/GitHub) so we can drop full-page loading skeletons and
 * keep the current page visible until the next one is ready.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-fog-400" aria-hidden />
  );
}
