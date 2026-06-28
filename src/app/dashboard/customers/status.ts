import type { CustomerStatus } from "@/lib/validations/customer";

type BadgeVariant = "emerald" | "amber" | "rose" | "outline";

export const CUSTOMER_STATUS_META: Record<CustomerStatus, { label: string; badge: BadgeVariant }> = {
  ACTIVE: { label: "Active", badge: "emerald" },
  INACTIVE: { label: "Inactive", badge: "amber" },
  BLOCKED: { label: "Blocked", badge: "rose" },
};

export const CUSTOMER_STATUSES: CustomerStatus[] = ["ACTIVE", "INACTIVE", "BLOCKED"];
