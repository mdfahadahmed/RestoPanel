"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ACCOUNT_NAV } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}

export function AccountSidebar({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-ink-900/40 lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
            R
          </span>
          <span className="text-sm">
            Resto<span className="text-gradient-gold">Panel</span>
          </span>
        </Link>

        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-fog-600">
          My Account
        </p>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {ACCOUNT_NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40",
                  active
                    ? "bg-ink-800 text-fog-100"
                    : "text-fog-400 hover:bg-ink-800/60 hover:text-fog-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {href === "/account/notifications" && unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[11px] font-semibold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <p className="px-3 pt-4 text-[11px] text-fog-600">RestoPanel · Customer</p>
      </div>
    </aside>
  );
}
