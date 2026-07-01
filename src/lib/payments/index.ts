import { isStripeEnabled } from "@/lib/billing/stripe";
import type { PaymentGateway, PaymentProvider, OnlineProvider } from "./types";
import { StripeGateway } from "./stripe";
import { CodGateway } from "./cod";
import { PayPalGateway } from "./paypal";
import { MockGateway } from "./mock";

export * from "./types";

// Registry of available providers. Add a new one here (e.g. "adyen") — nothing
// else in the app needs to change.
const gateways: Record<PaymentProvider, PaymentGateway> = {
  stripe: new StripeGateway(),
  paypal: new PayPalGateway(),
  cod: new CodGateway(),
  mock: new MockGateway(),
};

/** Get a specific provider's gateway. */
export function getGateway(provider: PaymentProvider): PaymentGateway {
  return gateways[provider];
}

/**
 * Resolve the gateway that should actually handle an ONLINE payment for a
 * restaurant's chosen provider:
 *  - PayPal → the PayPal gateway (throws "coming soon" until implemented).
 *  - Stripe → the real Stripe gateway when Stripe is configured, otherwise the
 *    deterministic mock (so local/dev/test checkout still works end to end).
 *  - `PAYMENTS_MODE=mock` forces the mock regardless (useful for demos/CI).
 */
export async function resolveOnlineGateway(
  preferred: OnlineProvider
): Promise<PaymentGateway> {
  if (preferred === "paypal") return gateways.paypal;
  if (process.env.PAYMENTS_MODE === "mock") return gateways.mock;
  const stripeReady = await isStripeEnabled();
  return stripeReady ? gateways.stripe : gateways.mock;
}

/** Whether real online payments (Stripe) are configured for this platform. */
export async function onlinePaymentsConfigured(): Promise<boolean> {
  return process.env.PAYMENTS_MODE === "mock" ? true : isStripeEnabled();
}
