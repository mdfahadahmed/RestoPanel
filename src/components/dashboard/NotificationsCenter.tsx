"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getNotifications, type NotificationFeed } from "@/app/dashboard/header-actions";

function prettyEvent(event: string): string {
  return event.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const STATUS_BADGE: Record<string, "emerald" | "amber" | "rose" | "outline"> = {
  SENT: "emerald",
  QUEUED: "amber",
  FAILED: "rose",
  SKIPPED: "outline",
};

export function NotificationsCenter() {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);

  async function load() {
    try {
      setFeed(await getNotifications());
    } catch {
      /* keep previous state */
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pending = feed?.pendingOrders ?? 0;

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${pending ? `, ${pending} pending orders` : ""}`}
          className="relative flex size-9 items-center justify-center rounded-xl border border-line bg-ink-900 text-fog-300 transition-colors hover:border-fog-600 hover:text-fog-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <Bell className="size-4" />
          {pending > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {pending > 9 ? "9+" : pending}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {pending > 0 && (
            <Link href="/dashboard/orders" className="text-xs text-violet-300 hover:text-violet-200">
              {pending} pending
            </Link>
          )}
        </div>

        {pending > 0 && (
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-2 border-b border-line bg-amber-400/5 px-4 py-2.5 text-sm text-amber-200 hover:bg-amber-400/10"
          >
            <Clock className="size-4" />
            {pending} order{pending === 1 ? "" : "s"} awaiting action
          </Link>
        )}

        <div className="max-h-80 overflow-y-auto py-1">
          {!feed ? (
            <p className="px-4 py-6 text-center text-sm text-fog-500">Loading…</p>
          ) : feed.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fog-500">No notifications yet.</p>
          ) : (
            feed.items.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-fog-100">{prettyEvent(n.event)}</p>
                  <p className="truncate text-xs text-fog-500">
                    {n.channel.toLowerCase()} · {n.recipient} · {timeAgo(n.createdAt)}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[n.status] ?? "outline"}>{n.status.toLowerCase()}</Badge>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
