import {
  PaymentError,
  type PaymentGateway,
  type CreateIntentInput,
  type CreateIntentResult,
  type RefundInput,
  type RefundResult,
  type RetrieveResult,
} from "./types";

/**
 * PayPal gateway — registered so the provider is selectable and the rest of the
 * pipeline is future-ready, but not yet implemented. Wiring it up is a matter of
 * filling these three methods against the PayPal Orders/Payments REST API (the
 * same shape as the Stripe gateway); nothing else in the app needs to change.
 */
export class PayPalGateway implements PaymentGateway {
  readonly name = "paypal" as const;
  readonly online = true;

  private notReady(): never {
    throw new PaymentError(
      "PayPal payments are coming soon. Please choose another method.",
      "not_implemented"
    );
  }

  async createIntent(_input: CreateIntentInput): Promise<CreateIntentResult> {
    return this.notReady();
  }

  async retrieve(_intentId: string): Promise<RetrieveResult> {
    return this.notReady();
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return this.notReady();
  }
}
