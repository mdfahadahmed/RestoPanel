"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Maximize, Minimize, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/validations/order";
import { compareTickets, type KdsBoard, type KdsColumn } from "@/lib/kds/shared";
import { OrderTicket } from "./OrderTicket";
import { KitchenTimer } from "./KitchenTimer";
import {
  advanceKitchenOrder,
  fetchKitchenBoard,
  toggleKitchenPriority,
} from "./actions";

const POLL_MS = 5000;

const COLUMNS: { key: KdsColumn; title: string; accent: string }[] = [
  { key: "new", title: "New Orders", accent: "text-sky-300" },
  { key: "preparing", title: "Preparing", accent: "text-violet-300" },
  { key: "ready", title: "Ready", accent: "text-gold-300" },
];

export function KitchenBoard({ initial }: { initial: KdsBoard }) {
  const [board, setBoard] = useState<KdsBoard>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetchKitchenBoard();
    if (res.ok && res.data) setBoard(res.data);
  }, []);

  // Poll the board, pausing while the tab is hidden to avoid wasted work.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Tick "now" every second so the per-ticket elapsed timers advance.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the fullscreen toggle in sync with the actual fullscreen state.
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen?.();
    }
  }

  function withBusy(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleAdvance(id: string, status: OrderStatus) {
    withBusy(id, true);
    // Optimistically remove the ticket from the board; reconcile via refresh.
    setBoard((prev) => ({
      new: prev.new.filter((t) => t.id !== id),
      preparing: prev.preparing.filter((t) => t.id !== id),
      ready: prev.ready.filter((t) => t.id !== id),
    }));
    const res = await advanceKitchenOrder({ id, status });
    if (!res.ok) toast.error(res.error);
    await refresh();
    withBusy(id, false);
  }

  async function handleTogglePriority(id: string, value: boolean) {
    // Optimistically flag + re-sort each column.
    setBoard((prev) => {
      const apply = (list: typeof prev.new) =>
        list
          .map((t) => (t.id === id ? { ...t, kitchenPriority: value } : t))
          .sort(compareTickets);
      return { new: apply(prev.new), preparing: apply(prev.preparing), ready: apply(prev.ready) };
    });
    const res = await toggleKitchenPriority({ id, value });
    if (!res.ok) toast.error(res.error);
    await refresh();
  }

  const total = board.new.length + board.preparing.length + board.ready.length;

  return (
    <div ref={rootRef} className="flex h-full flex-col gap-4 bg-ink-950">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kitchen Display</h1>
          <p className="mt-1 text-sm text-fog-400">
            {total} active {total === 1 ? "ticket" : "tickets"} · live every {POLL_MS / 1000}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh now"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-fog-200 hover:bg-ink-800"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm text-fog-200 hover:bg-ink-800"
          >
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </header>

      <KitchenTimer />

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const tickets = board[col.key];
          return (
            <section
              key={col.key}
              className="flex min-h-0 flex-col rounded-2xl border border-line bg-ink-900/40"
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className={cn("text-lg font-semibold tracking-tight", col.accent)}>
                  {col.title}
                </h2>
                <span className="rounded-full bg-ink-800 px-2.5 py-0.5 text-sm font-medium text-fog-200">
                  {tickets.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {tickets.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-fog-500">No tickets</p>
                ) : (
                  tickets.map((ticket) => (
                    <OrderTicket
                      key={ticket.id}
                      ticket={ticket}
                      column={col.key}
                      now={now}
                      busy={busy.has(ticket.id)}
                      onAdvance={handleAdvance}
                      onTogglePriority={handleTogglePriority}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
