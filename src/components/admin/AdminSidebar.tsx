"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_SECTIONS, isAdminNavActive } from "./nav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-ink-900/40 lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-ink-950">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">
            Resto<span className="text-gradient-gold">Panel</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider text-fog-500">
              Admin
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-4 overflow-y-auto pb-4">
          {ADMIN_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-fog-600">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(({ label, href, icon: Icon }) => {
                  const active = isAdminNavActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        active
                          ? "bg-ink-800 text-fog-100"
                          : "text-fog-400 hover:bg-ink-800/60 hover:text-fog-200"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <p className="px-3 pt-4 text-[11px] text-fog-600">Platform control · v1.0</p>
      </div>
    </aside>
  );
}
