import {
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  Calculator,
  FolderTree,
  UtensilsCrossed,
  Boxes,
  Users,
  UserCog,
  BarChart3,
  Star,
  Award,
  TicketPercent,
  CalendarCheck,
  QrCode,
  Bell,
  CreditCard,
  Code2,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// Grouped sidebar navigation for the Restaurant Dashboard.
export const DASHBOARD_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
      { label: "Kitchen", href: "/dashboard/kitchen", icon: ChefHat },
      { label: "POS", href: "/dashboard/pos", icon: Calculator },
      { label: "Reservations", href: "/dashboard/reservations", icon: CalendarCheck },
    ],
  },
  {
    title: "Menu",
    items: [
      { label: "Categories", href: "/dashboard/categories", icon: FolderTree },
      { label: "Products", href: "/dashboard/products", icon: UtensilsCrossed },
      { label: "Inventory", href: "/dashboard/inventory", icon: Boxes },
      { label: "QR Menu", href: "/dashboard/qr", icon: QrCode },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Customers", href: "/dashboard/customers", icon: Users },
      { label: "Staff", href: "/dashboard/staff", icon: UserCog },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Reviews", href: "/dashboard/reviews", icon: Star },
      { label: "Coupons", href: "/dashboard/coupons", icon: TicketPercent },
      { label: "Loyalty", href: "/dashboard/loyalty", icon: Award },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "API", href: "/dashboard/api", icon: Code2 },
      { label: "Security", href: "/dashboard/security", icon: ShieldCheck },
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

// Flat list (kept for any consumer that needs the items without sections).
export const DASHBOARD_NAV: NavItem[] = DASHBOARD_SECTIONS.flatMap((s) => s.items);
