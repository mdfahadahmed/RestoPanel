"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCOUNT_SECTIONS } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}

export function AccountMobileNav({ unread = 0 }: { unread?: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-900 text-fog-300"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col border-r border-line bg-ink-950 p-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
                  R
                </span>
                <span className="text-sm">My Account</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto">
              {ACCOUNT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-fog-600">
                    {section.title}
                  </p>
                  <div className="space-y-1">
                    {section.items.map(({ label, href, icon: Icon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                            active
                              ? "bg-ink-800 text-fog-100"
                              : "text-fog-400 hover:bg-ink-800/60 hover:text-fog-200"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1">{label}</span>
                          {href === "/account/notifications" && unread > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[11px] font-semibold text-white">
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
