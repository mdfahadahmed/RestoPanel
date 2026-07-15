"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { formatCurrency } from "@/lib/utils";
import type { PublicPlan } from "@/lib/marketing/content";

type Period = "monthly" | "annual";

export function PricingCards({ plans }: { plans: PublicPlan[] }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const anyTrial = plans.some((p) => p.trialDays > 0);

  return (
    <>
      {/* Billing period toggle */}
      <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-full border border-line bg-ink-900/60 p-1 text-sm">
        <ToggleButton active={period === "monthly"} onClick={() => setPeriod("monthly")}>
          Monthly
        </ToggleButton>
        <ToggleButton active={period === "annual"} onClick={() => setPeriod("annual")}>
          Annual
          <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            Save 20%
          </span>
        </ToggleButton>
      </div>

      {anyTrial && (
        <p className="mt-4 text-center text-sm text-fog-400">
          Paid plans start with a{" "}
          <span className="font-medium text-emerald-300">14-day free trial</span> — no
          card required.
        </p>
      )}

      <div className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const price = period === "annual" ? plan.annualMonthly : plan.monthly;
          const saved = (plan.monthly - plan.annualMonthly) * 12;
          const cta = plan.isFree
            ? "Start free"
            : plan.trialDays > 0
              ? `Start ${plan.trialDays}-day trial`
              : "Get started";
          return (
            <Reveal key={plan.slug} index={i}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-violet-500/50 bg-ink-900/80 shadow-glow"
                    : "border-line bg-ink-900/40"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-500 to-gold-400 px-3 py-1 text-[11px] font-semibold text-ink-950">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-fog-400">{plan.description}</p>
                )}
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {formatCurrency(price, plan.currency).replace(/\.00$/, "")}
                  </span>
                  <span className="pb-1 text-sm text-fog-500">/mo</span>
                </div>
                <p className="mt-1 h-4 text-xs text-emerald-300">
                  {period === "annual" && saved > 0
                    ? `Billed ${formatCurrency(plan.annualTotal, plan.currency).replace(/\.00$/, "")}/yr — ${formatCurrency(saved, plan.currency).replace(/\.00$/, "")} saved`
                    : ""}
                </p>

                <ul className="mt-5 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-fog-300">
                      <span className="mt-0.5 text-violet-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`btn-glow mt-7 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-white text-ink-950 hover:bg-fog-100"
                      : "border border-line bg-ink-850 text-fog-100 hover:border-fog-500"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-4 py-1.5 font-medium transition ${
        active ? "bg-white text-ink-950" : "text-fog-300 hover:text-fog-100"
      }`}
    >
      {children}
    </button>
  );
}
