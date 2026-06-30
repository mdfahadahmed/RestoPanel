import type { Role } from "@prisma/client";

/**
 * Role-based access control. Pure and dependency-free so it can be imported by
 * both server code (action/route guards) and client components (the permission
 * matrix UI). The single source of truth for "who can do what".
 */

export type Permission =
  | "dashboard:view"
  | "orders:view"
  | "orders:manage"
  | "pos:use"
  | "kitchen:use"
  | "menu:manage"
  | "customers:manage"
  | "reservations:manage"
  | "deliveries:manage"
  | "analytics:view"
  | "staff:manage"
  | "settings:manage"
  | "billing:manage"
  | "attendance:self"
  | "attendance:manage"
  | "shifts:view"
  | "shifts:manage";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard:view": "View dashboard",
  "orders:view": "View orders",
  "orders:manage": "Manage orders",
  "pos:use": "Use POS",
  "kitchen:use": "Use kitchen display",
  "menu:manage": "Manage menu",
  "customers:manage": "Manage customers",
  "reservations:manage": "Manage reservations",
  "deliveries:manage": "Manage deliveries",
  "analytics:view": "View analytics",
  "staff:manage": "Manage staff",
  "settings:manage": "Manage settings",
  "billing:manage": "Manage billing",
  "attendance:self": "Clock in / out",
  "attendance:manage": "Manage attendance",
  "shifts:view": "View own shifts",
  "shifts:manage": "Schedule shifts",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  KITCHEN: "Kitchen Staff",
  WAITER: "Waiter",
  DELIVERY: "Delivery",
  STAFF: "Staff",
};

const ALL: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

const MANAGER: Permission[] = [
  "dashboard:view",
  "orders:view",
  "orders:manage",
  "pos:use",
  "kitchen:use",
  "menu:manage",
  "customers:manage",
  "reservations:manage",
  "deliveries:manage",
  "analytics:view",
  "staff:manage",
  "attendance:self",
  "attendance:manage",
  "shifts:view",
  "shifts:manage",
];

/**
 * Per-role permission grants. OWNER implicitly has everything (see {@link can}).
 * Every role can clock itself in/out and see its own shifts.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  MANAGER,
  CASHIER: ["dashboard:view", "orders:view", "orders:manage", "pos:use", "attendance:self", "shifts:view"],
  KITCHEN: ["dashboard:view", "orders:view", "kitchen:use", "attendance:self", "shifts:view"],
  WAITER: [
    "dashboard:view",
    "orders:view",
    "orders:manage",
    "pos:use",
    "reservations:manage",
    "attendance:self",
    "shifts:view",
  ],
  DELIVERY: ["dashboard:view", "orders:view", "deliveries:manage", "attendance:self", "shifts:view"],
  STAFF: ["dashboard:view", "orders:view", "attendance:self", "shifts:view"],
};

/** Does `role` hold `permission`? OWNER always does. */
export function can(role: Role, permission: Permission): boolean {
  if (role === "OWNER") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Roles a manager/owner may assign to staff (never OWNER — there is one owner). */
export const ASSIGNABLE_ROLES: Role[] = ["MANAGER", "CASHIER", "KITCHEN", "WAITER", "DELIVERY", "STAFF"];

export function isAssignableRole(role: string): role is Role {
  return (ASSIGNABLE_ROLES as string[]).includes(role);
}
