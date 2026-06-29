import { NextResponse } from "next/server";
import { getStripeConfig, verifyStripeSignature } from "@/lib/billing/stripe";
import { processStripeEvent, type StripeEvent } from "@/lib/billing/webhook";

// Stripe needs the raw body to verify the signature — never parse it first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    // Return 500 so Stripe retries; log server-side only.
    console.error("[stripe webhook] processing error", e);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }
}
