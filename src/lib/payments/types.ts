// Provider-agnostic payment gateway contract.
//
// Any provider (Stripe, PayPal, cash-on-delivery, a test mock, …) implements
// `PaymentGateway`. The rest of the app depends only on this interface and the
// orchestration in `service.ts`, never on a concrete provider — so adding a
// provider is a new class in the registry, not a change to checkout/refund code.
// This mirrors the storage-provider-agnostic upload service (lib/upload).

import type { PaymentTxnStatus } from "@prisma/client";

export type PaymentProvider = "stripe" | "paypal" | "cod" | "mock";

/** Online card/wallet providers a restaurant can pick for storefront checkout. */
export type OnlineProvider = "stripe" | "paypal";

export interface CreateIntentInput {
  /** Amount in major units (e.g. 12.50 GBP). */
  amount: number;
  /** ISO currency, e.g. "GBP". */
  currency: string;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  description?: string;
  customerEmail?: string | null;
  /**
   * Test/dev only — force an outcome from the mock gateway. Ignored by real
   * providers. Never surfaced to storefront visitors.
   */
  simulate?: "succeed" | "fail";
}

export interface CreateIntentResult {
  provider: PaymentProvider;
  /** Provider payment-intent id (Stripe `pi_...`, `cod_...`, `pi_mock_...`). */
  intentId: string;
  /** Secret the client uses to confirm the charge (Stripe.js). Null for COD. */
  clientSecret: string | null;
  /** Initial transaction status. Online → PENDING; a rejected mock → FAILED. */
  status: PaymentTxnStatus;
  /** Whether the client must complete a confirmation step (online card). */
  requiresAction: boolean;
  amount: number;
}

export interface RetrieveResult {
  status: PaymentTxnStatus;
  amount: number | null;
  cardLast4?: string | null;
  failureReason?: string | null;
  /** Client secret to resume confirmation of an in-progress intent. */
  clientSecret?: string | null;
}

export interface RefundInput {
  intentId: string;
  /** Amount in major units. */
  amount: number;
  reason?: string;
}

export interface RefundResult {
  provider: PaymentProvider;
  refundId: string;
  amount: number;
  status: PaymentTxnStatus;
}

export interface PaymentGateway {
  readonly name: PaymentProvider;
  /** True when the provider performs an online charge needing client confirmation. */
  readonly online: boolean;
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  retrieve(intentId: string): Promise<RetrieveResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

/** Thrown for user-facing payment problems (declined, misconfigured, …). */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: string = "payment_error"
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/** Convert major units to the provider's minor units (2-decimal currencies). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
