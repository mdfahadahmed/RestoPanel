import {
  type CreateIntentInput,
  type CreateIntentResult,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type RetrieveResult,
} from "./types";

/**
 * Deterministic in-process gateway used when no real online provider is
 * configured (local dev, CI, tests). It mimics the Stripe lifecycle — an intent
 * starts PENDING with a fake client secret and is settled explicitly via the
 * confirm action (`confirmMockPayment` → `settlePaymentByIntent`), standing in
 * for the webhook. Passing `simulate: "fail"` models a declined card so the
 * failed-payment path can be exercised end to end. No network, no keys.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock" as const;
  readonly online = true;

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const intentId = `pi_mock_${input.orderId}`;
    if (input.simulate === "fail") {
      return {
        provider: "mock",
        intentId,
        clientSecret: null,
        status: "FAILED",
        requiresAction: false,
        amount: input.amount,
      };
    }
    return {
      provider: "mock",
      intentId,
      clientSecret: `${intentId}_secret_mock`,
      status: "PENDING",
      requiresAction: true,
      amount: input.amount,
    };
  }

  async retrieve(intentId: string): Promise<RetrieveResult> {
    // Settlement for the mock provider is driven by the confirm action, not by
    // polling — so retrieval reports PENDING and re-exposes the client secret so
    // an in-progress payment can be resumed on the pay page.
    return { status: "PENDING", amount: null, clientSecret: `${intentId}_secret_mock` };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      provider: "mock",
      refundId: `re_mock_${input.intentId}`,
      amount: input.amount,
      status: "REFUNDED",
    };
  }
}
