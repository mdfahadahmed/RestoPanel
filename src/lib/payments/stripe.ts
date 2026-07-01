import type { PaymentTxnStatus } from "@prisma/client";
import { stripeRequest } from "@/lib/billing/stripe";
import {
  toMinorUnits,
  type CreateIntentInput,
  type CreateIntentResult,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type RetrieveResult,
} from "./types";

/** Map a Stripe PaymentIntent status onto our transaction status. */
function mapStatus(stripeStatus: string): PaymentTxnStatus {
  switch (stripeStatus) {
    case "succeeded":
      return "SUCCEEDED";
    case "canceled":
      return "FAILED";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "requires_capture":
    case "processing":
    default:
      return "PENDING";
  }
}

interface StripePaymentIntent {
  id: string;
  client_secret: string | null;
  status: string;
  amount?: number;
  last_payment_error?: { message?: string } | null;
  charges?: {
    data?: Array<{
      payment_method_details?: { card?: { last4?: string } | null } | null;
    }>;
  };
}

/**
 * Stripe payment gateway. Talks to Stripe's REST API via the dependency-free
 * `stripeRequest` client (shared with billing). Confirmation happens client-side
 * with the returned `client_secret` (Stripe.js); the outcome is delivered by the
 * webhook, which calls `settlePaymentByIntent`.
 */
export class StripeGateway implements PaymentGateway {
  readonly name = "stripe" as const;
  readonly online = true;

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const pi = await stripeRequest<StripePaymentIntent>("POST", "payment_intents", {
      amount: toMinorUnits(input.amount),
      currency: input.currency.toLowerCase(),
      description: input.description,
      receipt_email: input.customerEmail || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        restaurantId: input.restaurantId,
      },
    });

    return {
      provider: "stripe",
      intentId: pi.id,
      clientSecret: pi.client_secret,
      status: mapStatus(pi.status),
      requiresAction: true,
      amount: input.amount,
    };
  }

  async retrieve(intentId: string): Promise<RetrieveResult> {
    const pi = await stripeRequest<StripePaymentIntent>(
      "GET",
      `payment_intents/${intentId}`
    );
    return {
      status: mapStatus(pi.status),
      amount: typeof pi.amount === "number" ? pi.amount / 100 : null,
      cardLast4:
        pi.charges?.data?.[0]?.payment_method_details?.card?.last4 ?? null,
      failureReason: pi.last_payment_error?.message ?? null,
      clientSecret: pi.client_secret,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await stripeRequest<{ id: string; status: string }>(
      "POST",
      "refunds",
      {
        payment_intent: input.intentId,
        amount: toMinorUnits(input.amount),
        reason: input.reason ? "requested_by_customer" : undefined,
      }
    );
    return {
      provider: "stripe",
      refundId: refund.id,
      amount: input.amount,
      status: "REFUNDED",
    };
  }
}
