import {
  LayoutDashboard,
  ShoppingBag,
  MapPinned,
  Heart,
  MapPin,
  User,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AccountNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AccountNavSection {
  title: string;
  items: AccountNavItem[];
}

// Grouped sidebar navigation for the customer account panel.
export const ACCOUNT_SECTIONS: AccountNavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/account", icon: LayoutDashboard }],
  },
  {
    title: "Orders",
    items: [
      { label: "My Orders", href: "/account/orders", icon: ShoppingBag },
      { label: "Track Order", href: "/account/track", icon: MapPinned },
    ],
  },
  {
    title: "Saved",
    items: [
      { label: "Favorites", href: "/account/favorites", icon: Heart },
      { label: "Addresses", href: "/account/addresses", icon: MapPin },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile", href: "/account/profile", icon: User },
      { label: "Notifications", href: "/account/notifications", icon: Bell },
      { label: "Settings", href: "/account/settings", icon: Settings },
    ],
  },
];

// Flat list (kept for any consumer that needs the items without sections).
export const ACCOUNT_NAV: AccountNavItem[] = ACCOUNT_SECTIONS.flatMap((s) => s.items);
