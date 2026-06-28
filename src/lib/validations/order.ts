import { z } from "zod";

// Enums -----------------------------------------------------------------------

export const orderTypeEnum = z.enum(["DELIVERY", "PICKUP", "DINE_IN"]);
export const paymentMethodEnum = z.enum(["CASH", "CARD", "ONLINE"]);
export const paymentStatusEnum = z.enum(["UNPAID", "PAID", "REFUNDED"]);
export const orderStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
  "REFUNDED",
]);

export type OrderStatus = z.infer<typeof orderStatusEnum>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

// Status workflow -------------------------------------------------------------

/**
 * Allowed status transitions. A status update is only valid if the target is
 * listed under the current status. Terminal states (DELIVERED's only exit is a
 * refund; CANCELLED/REJECTED/REFUNDED are end-of-line) have limited or no exits.
 */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REJECTED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Items -----------------------------------------------------------------------

export const orderItemVariantSchema = z.object({
  name: z.string().trim().min(1).max(60),
  priceAdjustment: z.coerce.number().min(-100000).max(100000).default(0),
});

export const orderItemExtraSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.coerce.number().min(0).max(100000).default(0),
});

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, "Product required"),
  quantity: z.coerce.number().int().min(1, "Min 1").max(999),
  variant: orderItemVariantSchema.nullable().optional(),
  extras: z.array(orderItemExtraSchema).max(50).default([]),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

// Create order ----------------------------------------------------------------

export const createOrderSchema = z
  .object({
    // Customer: pick an existing one, or provide details to find/create by phone.
    customerId: z.string().min(1).optional().nullable(),
    customerName: z.string().trim().max(120).optional().or(z.literal("")),
    customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
    customerEmail: z
      .string()
      .trim()
      .email("Invalid email")
      .optional()
      .or(z.literal("")),
    address: z.string().trim().max(400).optional().or(z.literal("")),

    type: orderTypeEnum.default("DELIVERY"),
    paymentMethod: paymentMethodEnum.default("CASH"),
    paymentStatus: paymentStatusEnum.default("UNPAID"),

    items: z.array(orderItemInputSchema).min(1, "Add at least one item").max(100),

    discountAmount: z.coerce.number().min(0).max(1000000).default(0),
    taxAmount: z.coerce.number().min(0).max(1000000).default(0),
    deliveryFee: z.coerce.number().min(0).max(1000000).default(0),

    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    restaurantNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // Delivery orders need an address; every order needs a customer name OR an
    // existing customerId so the order is attributable.
    if (data.type === "DELIVERY" && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address"],
        message: "Delivery address is required for delivery orders",
      });
    }
    if (!data.customerId && !data.customerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerName"],
        message: "Customer name is required",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateStatusSchema = z.object({
  id: z.string().min(1),
  status: orderStatusEnum,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updatePaymentSchema = z.object({
  id: z.string().min(1),
  paymentStatus: paymentStatusEnum.optional(),
  paymentMethod: paymentMethodEnum.optional(),
});

export const updateNotesSchema = z.object({
  id: z.string().min(1),
  restaurantNotes: z.string().trim().max(1000).optional().or(z.literal("")),
});

// Totals ----------------------------------------------------------------------

export interface ComputedTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
}

/** Per-unit price of an item including its variant adjustment and extras. */
export function unitPriceFor(
  basePrice: number,
  variant: { priceAdjustment: number } | null | undefined,
  extras: { price: number }[]
): number {
  const variantAdj = variant?.priceAdjustment ?? 0;
  const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);
  return round2(basePrice + variantAdj + extrasTotal);
}

/** Compute order totals from line subtotal + adjustments. Never goes negative. */
export function computeTotals(
  subtotal: number,
  discountAmount: number,
  taxAmount: number,
  deliveryFee: number
): ComputedTotals {
  const safeSubtotal = round2(Math.max(0, subtotal));
  const safeDiscount = round2(Math.min(Math.max(0, discountAmount), safeSubtotal));
  const total = round2(
    Math.max(0, safeSubtotal - safeDiscount + Math.max(0, taxAmount) + Math.max(0, deliveryFee))
  );
  return {
    subtotal: safeSubtotal,
    discountAmount: safeDiscount,
    taxAmount: round2(Math.max(0, taxAmount)),
    deliveryFee: round2(Math.max(0, deliveryFee)),
    total,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
