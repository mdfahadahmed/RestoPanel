"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ArrowUpCircle, ArrowDownCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { changePlanAction, cancelSubscriptionAction, resumeSubscriptionAction } from "./actions";

export interface PlanCardData {
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  position: number;
  hasStripePriceMonthly: boolean;
  hasStripePriceYearly: boolean;
}

export interface CurrentState {
  slug: string;
  position: number;
  status: string;
  cycle: "MONTHLY" | "YEARLY";
  cancelAtPeriodEnd: boolean;
}

function money(n: number, currency: string) {
  if (n === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function PlanManager({
  plans,
  current,
  stripeEnabled,
}: {
  plans: PlanCardData[];
  current: CurrentState | null;
  stripeEnabled: boolean;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">(current?.cycle ?? "MONTHLY");
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(plan: PlanCardData) {
    const isPaid = plan.priceMonthly > 0 || plan.priceYearly > 0;
    const hasPrice = cycle === "YEARLY" ? plan.hasStripePriceYearly : plan.hasStripePriceMonthly;

    setBusy(plan.slug);
    try {
      // Paid plan with Stripe configured → hosted Checkout.
      if (isPaid && stripeEnabled && hasPrice) {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: plan.slug, cycle }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Could not start checkout");
          return;
        }
        window.location.href = data.url;
        return;
      }

      // Manual flow.
      const result = await changePlanAction(plan.slug, cycle);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const kind = result.data?.kind;
      toast.success(
        kind === "trial"
          ? `Trial of ${plan.name} started`
          : kind === "downgrade"
            ? `Downgrade to ${plan.name} scheduled for period end`
            : `You're now on ${plan.name}`
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doCancel(immediately: boolean) {
    setBusy("cancel");
    try {
      const res = await cancelSubscriptionAction(immediately);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(immediately ? "Subscription canceled" : "Cancellation scheduled for period end");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doResume() {
    setBusy("resume");
    try {
      const res = await resumeSubscriptionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Subscription resumed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cycle toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-ink-900/40 p-1">
          {(["MONTHLY", "YEARLY"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                cycle === c ? "bg-ink-800 text-fog-100" : "text-fog-400 hover:text-fog-200"
              )}
            >
              {c === "MONTHLY" ? "Monthly" : "Yearly"}
              {c === "YEARLY" && <span className="ml-1.5 text-xs text-emerald-300">save ~17%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const price = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
          const isCurrent = current?.slug === plan.slug;
          const relation =
            !current || current.status === "CANCELED" || current.status === "EXPIRED"
              ? "choose"
              : plan.position > current.position
                ? "upgrade"
                : plan.position < current.position
                  ? "downgrade"
                  : "current";

          return (
            <Card
              key={plan.slug}
              className={cn(
                "relative flex flex-col",
                isCurrent && "border-violet-500/40 shadow-glow"
              )}
            >
              {isCurrent && (
                <span className="absolute right-3 top-3">
                  <Badge variant="violet">Current</Badge>
                </span>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">{plan.name}</CardTitle>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {money(price, plan.currency)}
                  {price > 0 && (
                    <span className="text-sm font-normal text-fog-500">
                      /{cycle === "YEARLY" ? "yr" : "mo"}
                    </span>
                  )}
                </div>
                {plan.description && <p className="text-xs text-fog-500">{plan.description}</p>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-1.5 text-sm text-fog-300">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {relation === "current" ? (
                  <Button variant="secondary" disabled className="w-full">
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant={relation === "downgrade" ? "outline" : "primary"}
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => choose(plan)}
                  >
                    {busy === plan.slug ? (
                      "Working…"
                    ) : relation === "upgrade" ? (
                      <>
                        <ArrowUpCircle className="h-4 w-4" /> Upgrade
                      </>
                    ) : relation === "downgrade" ? (
                      <>
                        <ArrowDownCircle className="h-4 w-4" /> Downgrade
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Choose
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cancel / resume */}
      {current && (
        <Card>
          <CardContent className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div className="text-sm text-fog-400">
              {current.status === "CANCELED" || current.status === "EXPIRED" ? (
                <>Your subscription is inactive. Choose a plan above to reactivate.</>
              ) : current.cancelAtPeriodEnd ? (
                <>Your subscription will end at the close of the current period.</>
              ) : (
                <>Manage your subscription lifecycle.</>
              )}
            </div>
            <div className="flex items-center gap-2">
              {current.cancelAtPeriodEnd || current.status === "CANCELED" || current.status === "EXPIRED" ? (
                <Button variant="primary" onClick={doResume} disabled={busy !== null}>
                  {current.status === "CANCELED" || current.status === "EXPIRED" ? "Reactivate" : "Resume"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => doCancel(false)} disabled={busy !== null}>
                    Cancel at period end
                  </Button>
                  <Button variant="destructive" onClick={() => doCancel(true)} disabled={busy !== null}>
                    Cancel now
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
