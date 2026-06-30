import Link from "next/link";
import { Plus, UtensilsCrossed, CalendarPlus, Calculator, ChefHat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "New order", href: "/dashboard/orders/new", icon: Plus },
  { label: "Add product", href: "/dashboard/products/new", icon: UtensilsCrossed },
  { label: "New reservation", href: "/dashboard/reservations", icon: CalendarPlus },
  { label: "Open POS", href: "/dashboard/pos", icon: Calculator },
  { label: "Kitchen", href: "/dashboard/kitchen", icon: ChefHat },
];

/** A row of one-tap shortcuts to the most common dashboard tasks. */
export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ACTIONS.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-2.5 rounded-xl border border-line bg-ink-900/50 px-3 py-3 text-sm font-medium text-fog-200 transition-colors hover:border-violet-500/40 hover:bg-ink-850 hover:text-fog-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-violet-300 transition-colors group-hover:bg-violet-500/15">
            <Icon className="size-4" />
          </span>
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </div>
  );
}
