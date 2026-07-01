import {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  ReceiptText,
  BarChart3,
  FileText,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

// Grouped sidebar navigation for the Super Admin panel.
export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Tenants",
    items: [
      { label: "Restaurants", href: "/admin/restaurants", icon: Store },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    title: "Revenue",
    items: [
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
      { label: "Billing", href: "/admin/billing", icon: ReceiptText },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Analytics", href: "/admin/analytics", icon: BarChart3 }],
  },
  {
    title: "Content",
    items: [
      { label: "CMS", href: "/admin/cms", icon: FileText },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
  },
];

// Flat list (kept for any consumer that needs the items without sections).
export const ADMIN_NAV: AdminNavItem[] = ADMIN_SECTIONS.flatMap((s) => s.items);

export function isAdminNavActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
