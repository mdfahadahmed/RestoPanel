"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ShoppingBag, UtensilsCrossed, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { globalSearch, type SearchResults } from "@/app/dashboard/header-actions";

const EMPTY: SearchResults = { orders: [], products: [], customers: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K opens the palette anywhere in the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced tenant-scoped search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(EMPTY);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => setResults(await globalSearch(q)));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const total = results.orders.length + results.products.length + results.customers.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-fog-400 transition-colors hover:border-fog-600 hover:text-fog-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-2 hidden rounded border border-line bg-ink-800 px-1.5 py-0.5 text-[10px] text-fog-500 sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[12%] max-w-lg translate-y-0 gap-0 p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Search the dashboard</DialogTitle>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="size-4 text-fog-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders, products, customers…"
              aria-label="Search query"
              className="h-12 w-full bg-transparent text-sm text-fog-100 outline-none placeholder:text-fog-500"
            />
            {pending && <Loader2 className="size-4 animate-spin text-fog-500" />}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {query.trim() && total === 0 && !pending && (
              <p className="px-3 py-6 text-center text-sm text-fog-500">No matches for “{query.trim()}”.</p>
            )}
            {!query.trim() && (
              <p className="px-3 py-6 text-center text-sm text-fog-500">Type to search across your restaurant.</p>
            )}

            <Group label="Orders" show={results.orders.length > 0}>
              {results.orders.map((o) => (
                <ResultRow key={o.id} icon={ShoppingBag} onSelect={() => go(`/dashboard/orders/${o.id}`)}>
                  <span className="font-medium text-fog-100">#{o.orderNumber}</span>
                  <span className="text-fog-500"> · {o.label}</span>
                </ResultRow>
              ))}
            </Group>
            <Group label="Products" show={results.products.length > 0}>
              {results.products.map((p) => (
                <ResultRow key={p.id} icon={UtensilsCrossed} onSelect={() => go(`/dashboard/products`)}>
                  <span className="text-fog-100">{p.name}</span>
                </ResultRow>
              ))}
            </Group>
            <Group label="Customers" show={results.customers.length > 0}>
              {results.customers.map((c) => (
                <ResultRow key={c.id} icon={Users} onSelect={() => go(`/dashboard/customers/${c.id}`)}>
                  <span className="text-fog-100">{c.name}</span>
                  <span className="text-fog-500"> · {c.phone}</span>
                </ResultRow>
              ))}
            </Group>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fog-500">{label}</p>
      {children}
    </div>
  );
}

function ResultRow({
  icon: Icon,
  onSelect,
  children,
}: {
  icon: import("lucide-react").LucideIcon;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-800 focus-visible:bg-ink-800 focus-visible:outline-none"
    >
      <Icon className="size-4 shrink-0 text-fog-500" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
