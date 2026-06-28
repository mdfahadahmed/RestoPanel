"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Counter } from "./Counter";

export function Hero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;

    (async () => {
      const { gsap } = await import("gsap");
      const root = rootRef.current;
      if (!root) return;

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero='badge']", { y: 16, opacity: 0, duration: 0.6 })
          .from(
            "[data-hero='line']",
            { yPercent: 120, opacity: 0, duration: 0.9, stagger: 0.12 },
            "-=0.2"
          )
          .from("[data-hero='sub']", { y: 20, opacity: 0, duration: 0.7 }, "-=0.4")
          .from("[data-hero='cta']", { y: 18, opacity: 0, duration: 0.6 }, "-=0.4")
          .from("[data-hero='stats']", { y: 18, opacity: 0, duration: 0.6 }, "-=0.3")
          .from(
            "[data-hero='panel']",
            { y: 40, opacity: 0, scale: 0.98, duration: 1 },
            "-=0.7"
          );
      }, root);
    })();

    return () => ctx?.revert();
  }, []);

  // Mouse parallax for the floating dashboard panel.
  function handleMouseMove(e: React.MouseEvent) {
    const el = parallaxRef.current;
    if (!el) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 18;
    const y = (e.clientY / innerHeight - 0.5) * 18;
    el.style.transform = `perspective(1200px) rotateX(${-y * 0.4}deg) rotateY(${x * 0.4}deg) translate3d(${x}px, ${y}px, 0)`;
  }

  return (
    <section
      ref={rootRef}
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pt-44"
    >
      <div className="pointer-events-none absolute inset-0 bg-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="relative mx-auto max-w-5xl text-center">
        <div
          data-hero="badge"
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3.5 py-1.5 text-xs text-fog-300 backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Trusted by restaurants across the UK, US & Canada
        </div>

        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="block overflow-hidden">
            <span data-hero="line" className="block">
              The operating system
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero="line" className="block text-gradient">
              for modern restaurants
            </span>
          </span>
        </h1>

        <p
          data-hero="sub"
          className="mx-auto mt-6 max-w-2xl text-pretty text-base text-fog-400 sm:text-lg"
        >
          Register, get your own branded dashboard and customer ordering site, and
          run your entire restaurant — menus, orders, customers, analytics and SMS
          updates — from one elegant platform.
        </p>

        <div
          data-hero="cta"
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/register"
            className="btn-glow w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 sm:w-auto"
          >
            Start free — create your dashboard
          </Link>
          <a
            href="#dashboard"
            className="w-full rounded-xl border border-line bg-ink-900/50 px-6 py-3 text-sm font-medium text-fog-200 backdrop-blur transition hover:border-fog-500 sm:w-auto"
          >
            See the dashboard
          </a>
        </div>

        <div
          data-hero="stats"
          className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4"
        >
          {[
            { label: "Orders processed", node: <Counter to={2.4} decimals={1} suffix="M+" /> },
            { label: "Avg. setup time", node: <Counter to={3} suffix=" min" /> },
            { label: "Uptime", node: <Counter to={99.9} decimals={1} suffix="%" /> },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl px-3 py-4">
              <div className="text-xl font-semibold sm:text-2xl">{s.node}</div>
              <div className="mt-1 text-xs text-fog-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating dashboard panel */}
      <div className="relative mx-auto mt-16 max-w-5xl" style={{ perspective: 1200 }}>
        <div
          ref={parallaxRef}
          data-hero="panel"
          className="glass rounded-2xl p-2 shadow-glow transition-transform duration-200 ease-out will-change-transform"
        >
          <div className="rounded-xl border border-line bg-ink-900/80 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs text-fog-500">app.restopanel.com/dashboard</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { k: "Today's revenue", v: "£2,847", d: "+18%" },
                { k: "Orders", v: "126", d: "+9%" },
                { k: "Avg. prep time", v: "14 min", d: "-2 min" },
              ].map((c) => (
                <div key={c.k} className="rounded-xl border border-line bg-ink-850 p-4">
                  <div className="text-xs text-fog-400">{c.k}</div>
                  <div className="mt-1 text-2xl font-semibold">{c.v}</div>
                  <div className="mt-1 text-xs text-emerald-400">{c.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-32 items-end gap-2 rounded-xl border border-line bg-ink-850 p-4">
              {[40, 65, 50, 80, 60, 95, 72, 88, 70, 100, 84, 92].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-violet-500/40 to-violet-400"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
