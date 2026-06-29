import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { getPlanBySlug } from "@/lib/billing/plans";
import { getStripeConfig, createCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({
  plan: z.string().min(1),
  cycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

/**
 * Start a Stripe Checkout session for the signed-in tenant. Returns a hosted
 * URL the client redirects to. (Manual upgrades — when Stripe is off — go
 * through the server action instead.)
 */
export async function POST(request: Request) {
  const { restaurantId } = await requireTenant();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const cfg = await getStripeConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const plan = await getPlanBySlug(parsed.data.plan);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

  const priceId =
    parsed.data.cycle === "YEARLY" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
  if (!priceId) {
    return NextResponse.json(
      { error: "This plan is not available for online checkout yet" },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await createCheckoutSession({
      restaurantId,
      priceId,
      trialDays: plan.trialDays,
      successUrl: `${origin}/dashboard/billing?status=success`,
      cancelUrl: `${origin}/dashboard/billing?status=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
