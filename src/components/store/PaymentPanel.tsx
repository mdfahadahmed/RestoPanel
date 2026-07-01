"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { confirmMockPaymentPublic } from "@/app/r/[slug]/actions";

interface PaymentPanelProps {
  slug: string;
  orderId: string;
  orderNumber: string;
  total: number;
  currencySymbol: string;
  provider: string;
  clientSecret: string | null;
  publishableKey: string | null;
  trackHref: string;
}

export function PaymentPanel(props: PaymentPanelProps) {
  if (props.provider === "stripe") return <StripePayment {...props} />;
  if (props.provider === "mock") return <MockPayment {...props} />;
  // COD / unknown shouldn't reach the pay page.
  return (
    <div className="rounded-2xl border border-line bg-ink-900/50 p-6 text-center text-sm text-fog-400">
      No online payment is required for this order.
    </div>
  );
}

function AmountHeader({ total }: { total: number }) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-line bg-ink-900/50 px-5 py-4">
      <span className="text-sm text-fog-400">Amount due</span>
      <span className="text-xl font-semibold text-fog-100">{formatCurrency(total)}</span>
    </div>
  );
}

/**
 * Deterministic test payment (used when no real Stripe key is configured). Lets
 * the full paid/failed flow be exercised in dev without a card.
 */
function MockPayment(props: PaymentPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function pay(outcome: "succeed" | "fail") {
    setPending(true);
    try {
      const res = await confirmMockPaymentPublic(props.slug, props.orderId, outcome);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (outcome === "fail") {
        toast.error("Payment declined. Please try again.");
        return;
      }
      toast.success("Payment successful!");
      router.push(props.trackHref);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <AmountHeader total={props.total} />
      <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-fog-300">
          <CreditCard className="h-4 w-4 text-violet-300" />
          Test payment mode
        </div>
        <p className="text-xs text-fog-500">
          This restaurant hasn&apos;t connected a live payment provider yet, so
          payments run in test mode. No real card is charged.
        </p>
        <button
          type="button"
          onClick={() => pay("succeed")}
          disabled={pending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {pending ? "Processing…" : `Pay ${formatCurrency(props.total)}`}
        </button>
        <button
          type="button"
          onClick={() => pay("fail")}
          disabled={pending}
          className="mt-2 w-full text-center text-xs text-fog-500 transition hover:text-rose-300 disabled:opacity-60"
        >
          Simulate a declined payment
        </button>
      </div>
    </div>
  );
}

// Minimal typing for the Stripe.js global loaded from the CDN.
interface StripeLike {
  elements(opts: { clientSecret: string }): {
    create(type: string): { mount(selector: string | HTMLElement): void };
    submit?(): Promise<{ error?: { message?: string } }>;
  };
  confirmPayment(opts: {
    elements: unknown;
    confirmParams: { return_url: string };
  }): Promise<{ error?: { message?: string } }>;
}

/**
 * Real Stripe payment via Payment Element (Stripe.js loaded from the CDN — no npm
 * dependency). Confirmation redirects to the tracking page; the webhook settles
 * the order server-side.
 */
function StripePayment(props: PaymentPanelProps) {
  const elementsRef = useRef<ReturnType<StripeLike["elements"]> | null>(null);
  const stripeRef = useRef<StripeLike | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.publishableKey || !props.clientSecret) {
      setError("Payment is temporarily unavailable. Please try again shortly.");
      return;
    }
    let cancelled = false;

    async function load() {
      const w = window as unknown as { Stripe?: (key: string) => StripeLike };
      if (!w.Stripe) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.stripe.com/v3";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("stripe-load-failed"));
          document.head.appendChild(script);
        }).catch(() => {
          if (!cancelled) setError("Could not load the payment form.");
        });
      }
      if (cancelled || !w.Stripe) return;
      const stripe = w.Stripe(props.publishableKey!);
      stripeRef.current = stripe;
      const elements = stripe.elements({ clientSecret: props.clientSecret! });
      elementsRef.current = elements;
      elements.create("payment").mount("#stripe-payment-element");
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.publishableKey, props.clientSecret]);

  async function submit() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${props.trackHref}` },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment failed. Please try again.");
      setPending(false);
    }
    // On success Stripe redirects to return_url; the webhook settles the order.
  }

  return (
    <div>
      <AmountHeader total={props.total} />
      <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
        <div id="stripe-payment-element" className="min-h-[3rem]" />
        {!ready && !error && (
          <div className="flex items-center gap-2 text-sm text-fog-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading secure form…
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {pending ? "Processing…" : `Pay ${formatCurrency(props.total)}`}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-fog-600">
          <Lock className="h-3 w-3" /> Secured by Stripe
        </p>
      </div>
    </div>
  );
}
