// Client-safe formatting helpers for the admin UI (no server imports).

export function formatMoney(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoney2(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type BadgeVariant =
  | "default"
  | "violet"
  | "emerald"
  | "amber"
  | "sky"
  | "rose"
  | "gold"
  | "outline";

export function restaurantStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "emerald";
    case "SUSPENDED":
      return "rose";
    case "PENDING":
      return "amber";
    default:
      return "outline";
  }
}

export function subscriptionStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "emerald";
    case "TRIALING":
      return "sky";
    case "PAST_DUE":
      return "amber";
    case "CANCELED":
    case "EXPIRED":
      return "rose";
    default:
      return "outline";
  }
}

export function invoiceStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "PAID":
      return "emerald";
    case "OPEN":
      return "amber";
    case "VOID":
    case "UNCOLLECTIBLE":
      return "rose";
    default:
      return "outline";
  }
}

export function ticketStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "OPEN":
      return "sky";
    case "PENDING":
      return "amber";
    case "RESOLVED":
      return "emerald";
    case "CLOSED":
      return "outline";
    default:
      return "outline";
  }
}

export function ticketPriorityVariant(p: string): BadgeVariant {
  switch (p) {
    case "URGENT":
      return "rose";
    case "HIGH":
      return "amber";
    case "NORMAL":
      return "sky";
    case "LOW":
      return "outline";
    default:
      return "outline";
  }
}
