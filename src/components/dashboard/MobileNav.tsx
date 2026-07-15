"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DASHBOARD_SECTIONS } from "./nav";
import { NavPending } from "./NavPending";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-screen max-w-[16rem] translate-x-0 translate-y-0 rounded-none rounded-r-2xl">
        <DialogTitle className="mb-2 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
            R
          </span>
          <span className="text-sm">
            Resto<span className="text-gradient-gold">Panel</span>
          </span>
        </DialogTitle>
        <nav className="max-h-[calc(100dvh-5rem)] space-y-4 overflow-y-auto pb-4">
          {DASHBOARD_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-fog-600">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(({ label, href, icon: Icon }) => {
                  const active =
                    href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(href);
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
                      {label}
                      <NavPending />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
