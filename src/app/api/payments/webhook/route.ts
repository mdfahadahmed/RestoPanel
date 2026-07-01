import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeConfig, verifyStripeSignature } from "@/lib/billing/stripe";
import { settlePaymentByIntent } from "@/lib/payments/service";

// Stripe needs the raw body to verify the signature — never parse it first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      last_payment_error?: { message?: string } | null;
      charges?: {
        data?: Array<{
          payment_method_details?: { card?: { last4?: string } | null } | null;
        }>;
      };
    };
  };
}

/**
 * Customer-order payment webhook (separate from the billing webhook). Settles
 * PaymentIntents for storefront orders. Idempotent via ProcessedWebhook so Stripe
 * retries never double-apply an event.
 */
export async function POST(request: Request) {
  const cfg = await getStripeConfig();
  if (!cfg || !cfg.webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  const valid = await verifyStripeSignature({
    payload,
    signatureHeader: signature,
    secret: cfg.webhookSecret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Idempotency guard — record the event id once.
  try {
    await prisma.processedWebhook.create({
      data: { id: event.id, type: event.type },
    });
  } catch {
    // Already processed (unique violation) — acknowledge without re-applying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const intent = event.data.object;
    if (event.type === "payment_intent.succeeded") {
      const cardLast4 =
        intent.charges?.data?.[0]?.payment_method_details?.card?.last4 ?? null;
      await settlePaymentByIntent(intent.id, "succeeded", { cardLast4, reference: intent.id });
    } else if (event.type === "payment_intent.payment_failed") {
      await settlePaymentByIntent(intent.id, "failed", {
        failureReason: intent.last_payment_error?.message ?? "Payment failed",
      });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    // Roll back the idempotency record so Stripe retries deliver again.
    await prisma.processedWebhook.delete({ where: { id: event.id } }).catch(() => undefined);
    console.error("[payments webhook] processing error", e);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }
}
