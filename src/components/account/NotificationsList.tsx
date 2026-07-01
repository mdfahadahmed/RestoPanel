"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Megaphone,
  MessageSquare,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
} from "@/app/account/actions";

type NotifType = "ORDER_UPDATE" | "PROMOTION" | "RESTAURANT_MESSAGE";

export interface NotificationItem {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  restaurantName: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const ICON: Record<NotifType, typeof Bell> = {
  ORDER_UPDATE: ShoppingBag,
  PROMOTION: Megaphone,
  RESTAURANT_MESSAGE: MessageSquare,
};

const ACCENT: Record<NotifType, string> = {
  ORDER_UPDATE: "from-violet-500/20 to-violet-500/5 text-violet-300",
  PROMOTION: "from-gold-400/20 to-gold-400/5 text-gold-300",
  RESTAURANT_MESSAGE: "from-sky-400/20 to-sky-400/5 text-sky-300",
};

export function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => setItems(initial), [initial]);

  const unread = items.filter((n) => !n.isRead).length;

  function onOpen(n: NotificationItem) {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      startTransition(async () => {
        await markNotificationRead(n.id);
        router.refresh();
      });
    }
  }

  function onMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res.ok) toast.success("All caught up");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await deleteNotification(id);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-ink-900/30 px-6 py-16 text-center">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-ink-850 text-fog-400">
          <Bell className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold">No notifications</h3>
        <p className="mt-1 max-w-sm text-sm text-fog-400">
          Order updates and offers from your restaurants will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMarkAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-sm text-fog-300 transition hover:bg-ink-800 hover:text-fog-100"
          >
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = ICON[n.type];
          const inner = (
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                n.isRead
                  ? "border-line bg-ink-900/30"
                  : "border-violet-500/20 bg-violet-500/5"
              }`}
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${ACCENT[n.type]}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-fog-100">{n.title}</p>
                  {!n.isRead && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-fog-400">{n.body}</p>
                <p className="mt-1 text-xs text-fog-600">{formatDate(n.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(n.id);
                }}
                aria-label="Delete notification"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fog-500 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );

          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => onOpen(n)} className="block">
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={() => onOpen(n)} className="block w-full text-left">
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
