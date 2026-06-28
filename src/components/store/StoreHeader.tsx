"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShoppingBag, Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart/CartProvider";

interface StoreHeaderProps {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export function StoreHeader({ slug, name, logoUrl }: StoreHeaderProps) {
  const base = `/r/${slug}`;
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);

  const links = [
    { href: base, label: "Home" },
    { href: `${base}/menu`, label: "Menu" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/reservation`, label: "Reserve" },
    { href: `${base}/contact`, label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={base} className="flex items-center gap-2.5">
          {logoUrl ? (
            <Image src={logoUrl} alt={name} width={36} height={36} className="h-9 w-9 rounded-full object-cover ring-1 ring-line" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-violet-500 text-sm font-bold text-ink-950">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-lg font-semibold tracking-tight text-fog-100">{name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition",
                  active ? "bg-ink-800 text-fog-100" : "text-fog-400 hover:text-fog-100"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={`${base}/cart`}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-ink-900 text-fog-200 transition hover:text-fog-50"
            aria-label="Cart"
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {ready && count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-ink-950">
                {count}
              </span>
            )}
          </Link>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-ink-900 text-fog-200 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-ink-950 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-fog-300 hover:bg-ink-900 hover:text-fog-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
