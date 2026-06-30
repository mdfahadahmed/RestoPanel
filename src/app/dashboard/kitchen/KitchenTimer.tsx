"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, Play, Pause, RotateCcw, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimer {
  id: string;
  label: string;
  totalSec: number;
  remainingSec: number;
  running: boolean;
  done: boolean;
}

const PRESETS = [5, 10, 15];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Short beep using the Web Audio API (no asset needed). Best-effort. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — the visual alert still fires */
  }
}

/**
 * Standalone kitchen countdown timers (e.g. "fries — 4:00"). Pure local state,
 * independent of order data; multiple can run at once.
 */
export function KitchenTimer() {
  const [timers, setTimers] = useState<CountdownTimer[]>([]);
  const [custom, setCustom] = useState("");
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (timers.every((t) => !t.running)) return;
    const id = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running || t.remainingSec <= 0) return t;
          const remainingSec = t.remainingSec - 1;
          return { ...t, remainingSec, running: remainingSec > 0, done: remainingSec <= 0 };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, [timers]);

  // Fire the alert once per timer when it reaches zero.
  useEffect(() => {
    for (const t of timers) {
      if (t.done && !firedRef.current.has(t.id)) {
        firedRef.current.add(t.id);
        beep();
      }
    }
  }, [timers]);

  function addTimer(minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const sec = Math.round(minutes * 60);
    setTimers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: `${minutes} min`,
        totalSec: sec,
        remainingSec: sec,
        running: true,
        done: false,
      },
    ]);
  }

  function toggle(id: string) {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, running: !t.running && t.remainingSec > 0 } : t))
    );
  }

  function reset(id: string) {
    firedRef.current.delete(id);
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, remainingSec: t.totalSec, running: false, done: false } : t
      )
    );
  }

  function remove(id: string) {
    firedRef.current.delete(id);
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-900/60 p-3">
      <div className="flex items-center gap-2">
        <Timer className="size-4 text-violet-300" />
        <span className="text-sm font-semibold text-fog-200">Kitchen timers</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => addTimer(m)}
            className="h-9 rounded-lg border border-line bg-ink-850 px-3 text-sm text-fog-200 hover:bg-ink-800"
          >
            {m}m
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTimer(Number(custom));
            setCustom("");
          }}
          className="flex items-center gap-1"
        >
          <input
            type="number"
            min={1}
            max={180}
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="min"
            aria-label="Custom timer minutes"
            className="h-9 w-16 rounded-lg border border-line bg-ink-950 px-2 text-sm text-fog-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <button
            type="submit"
            aria-label="Add timer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-850 text-fog-200 hover:bg-ink-800"
          >
            <Plus className="size-4" />
          </button>
        </form>
      </div>

      {timers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {timers.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-ink-950/60 px-3 py-2",
                t.done ? "border-rose-500/50 motion-safe:animate-pulse" : "border-line"
              )}
            >
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  t.done ? "text-rose-300" : "text-fog-100"
                )}
              >
                {fmt(t.remainingSec)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  disabled={t.done}
                  aria-label={t.running ? "Pause" : "Start"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-200 hover:bg-ink-800 disabled:opacity-40"
                >
                  {t.running ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => reset(t.id)}
                  aria-label="Reset"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-200 hover:bg-ink-800"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Remove"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-400 hover:bg-ink-800 hover:text-rose-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
