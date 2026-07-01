"use client";

import { useEffect, useRef } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface StatsProps {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  loyaltyPoints: number;
}

const ACCENTS: Record<string, string> = {
  violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
  gold: "from-gold-400/20 to-gold-400/5 text-gold-300",
  emerald: "from-emerald-400/20 to-emerald-400/5 text-emerald-300",
  rose: "from-rose-500/20 to-rose-500/5 text-rose-300",
  sky: "from-sky-400/20 to-sky-400/5 text-sky-300",
};

export function DashboardStats(props: StatsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !containerRef.current) return;
      ctx = gsap.context(() => {
        gsap.from(".account-stat", {
          y: 16,
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.07,
        });
      }, containerRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  const cards: {
    label: string;
    value: number;
    icon: LucideIcon;
    accent: keyof typeof ACCENTS;
    hint?: string;
  }[] = [
    { label: "Total Orders", value: props.total, icon: ShoppingBag, accent: "violet" },
    { label: "Active Orders", value: props.active, icon: Clock, accent: "sky" },
    { label: "Completed", value: props.completed, icon: CheckCircle2, accent: "emerald" },
    { label: "Cancelled", value: props.cancelled, icon: XCircle, accent: "rose" },
    {
      label: "Loyalty Points",
      value: props.loyaltyPoints,
      icon: Sparkles,
      accent: "gold",
      hint: "Coming soon",
    },
  ];

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
    >
      {cards.map((c) => (
        <div
          key={c.label}
          className="account-stat rounded-2xl border border-line bg-ink-900/50 p-4 shadow-soft"
        >
          <div
            className={`mb-3 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${ACCENTS[c.accent]}`}
          >
            <c.icon className="h-4.5 w-4.5" />
          </div>
          <p className="text-2xl font-semibold tracking-tight text-fog-100">
            {c.value.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-fog-400">{c.label}</p>
          {c.hint && (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-fog-600">
              {c.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
