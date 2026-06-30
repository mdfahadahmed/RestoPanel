import {
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  Calculator,
  FolderTree,
  UtensilsCrossed,
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

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
  { label: "Kitchen", href: "/dashboard/kitchen", icon: ChefHat },
  { label: "POS", href: "/dashboard/pos", icon: Calculator },
  { label: "Categories", href: "/dashboard/categories", icon: FolderTree },
  { label: "Products", href: "/dashboard/products", icon: UtensilsCrossed },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog },
  { label: "Reservations", href: "/dashboard/reservations", icon: CalendarCheck },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Reviews", href: "/dashboard/reviews", icon: Star },
  { label: "Coupons", href: "/dashboard/coupons", icon: TicketPercent },
  { label: "Loyalty", href: "/dashboard/loyalty", icon: Award },
  { label: "QR Menu", href: "/dashboard/qr", icon: QrCode },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "API", href: "/dashboard/api", icon: Code2 },
  { label: "Security", href: "/dashboard/security", icon: ShieldCheck },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
