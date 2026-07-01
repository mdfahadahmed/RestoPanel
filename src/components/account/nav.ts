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

export const ACCOUNT_NAV: AccountNavItem[] = [
  { label: "Dashboard", href: "/account", icon: LayoutDashboard },
  { label: "My Orders", href: "/account/orders", icon: ShoppingBag },
  { label: "Track Order", href: "/account/track", icon: MapPinned },
  { label: "Favorites", href: "/account/favorites", icon: Heart },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Profile", href: "/account/profile", icon: User },
  { label: "Notifications", href: "/account/notifications", icon: Bell },
  { label: "Settings", href: "/account/settings", icon: Settings },
];
