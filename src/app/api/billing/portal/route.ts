import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { getStripeConfig, createBillingPortalSession } from "@/lib/billing/stripe";

/** Open the Stripe Billing Portal for the signed-in tenant to manage their card/plan. */
export async function POST(request: Request) {
  const { restaurantId } = await requireTenant();

  const cfg = await getStripeConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await createBillingPortalSession(
      restaurantId,
      `${origin}/dashboard/billing`
    );
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not open billing portal";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
