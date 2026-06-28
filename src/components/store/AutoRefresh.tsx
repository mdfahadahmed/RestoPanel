"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Periodically refreshes the route so the order status stays up to date. */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
