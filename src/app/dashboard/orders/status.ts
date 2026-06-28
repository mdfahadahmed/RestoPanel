import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/validations/order";

type BadgeVariant = "default" | "violet" | "emerald" | "amber" | "sky" | "rose" | "gold" | "outline";

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badge: BadgeVariant }> = {
  PENDING: { label: "Pending", badge: "amber" },
  CONFIRMED: { label: "Confirmed", badge: "sky" },
  PREPARING: { label: "Preparing", badge: "violet" },
  READY: { label: "Ready", badge: "gold" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", badge: "sky" },
  DELIVERED: { label: "Delivered", badge: "emerald" },
  CANCELLED: { label: "Cancelled", badge: "rose" },
  REJECTED: { label: "Rejected", badge: "rose" },
  REFUNDED: { label: "Refunded", badge: "outline" },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; badge: BadgeVariant }> = {
  UNPAID: { label: "Unpaid", badge: "amber" },
  PAID: { label: "Paid", badge: "emerald" },
  REFUNDED: { label: "Refunded", badge: "outline" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  ONLINE: "Online",
};

export const ORDER_TYPE_LABEL: Record<"DELIVERY" | "PICKUP" | "DINE_IN", string> = {
  DELIVERY: "Delivery",
  PICKUP: "Takeaway",
  DINE_IN: "Dine in",
};

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
  "REFUNDED",
];
