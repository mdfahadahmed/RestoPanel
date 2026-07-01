"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_SECTIONS, isAdminNavActive } from "./nav";

export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-ink-950">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-sm">
            Resto<span className="text-gradient-gold">Panel</span> Admin
          </span>
        </DialogTitle>
        <nav className="max-h-[calc(100dvh-5rem)] space-y-4 overflow-y-auto pb-4">
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
      </DialogContent>
    </Dialog>
  );
}
