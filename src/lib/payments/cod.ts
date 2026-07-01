import {
  type CreateIntentInput,
  type CreateIntentResult,
  type PaymentGateway,
  type RefundInput,
  type RefundResult,
  type RetrieveResult,
} from "./types";

/**
 * Cash on delivery / pay on collection. No online charge is taken — the order is
 * settled in person, so the payment stays PENDING (the order UNPAID) until staff
 * mark it paid. Refunds are handled off-platform (cash returned); we only record
 * the ledger entry.
 */
export class CodGateway implements PaymentGateway {
  readonly name = "cod" as const;
  readonly online = false;

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    return {
      provider: "cod",
      intentId: `cod_${input.orderId}`,
      clientSecret: null,
      status: "PENDING",
      requiresAction: false,
      amount: input.amount,
    };
  }

  async retrieve(): Promise<RetrieveResult> {
    return { status: "PENDING", amount: null, clientSecret: null };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      provider: "cod",
      refundId: `codref_${input.intentId}`,
      amount: input.amount,
      status: "REFUNDED",
    };
  }
}
