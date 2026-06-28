"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/lib/storefront/product";
import { ProductCard } from "./ProductCard";

export type MenuItem = StoreProduct & { categoryId: string | null };
type Category = { id: string; name: string };
type Sort = "featured" | "price-asc" | "price-desc" | "name";

export function MenuBrowser({
  slug,
  items,
  categories,
  initialCategory,
}: {
  slug: string;
  items: MenuItem[];
  categories: Category[];
  initialCategory?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(initialCategory ?? "all");
  const [sort, setSort] = useState<Sort>("featured");
  const [maxPrice, setMaxPrice] = useState<number>(0); // 0 = no cap

  const priceCeiling = useMemo(
    () => Math.ceil(Math.max(1, ...items.map((i) => i.effective))),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((i) => {
      if (category !== "all" && i.categoryId !== category) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.shortDescription ?? "").toLowerCase().includes(q)) return false;
      if (maxPrice > 0 && i.effective > maxPrice) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.effective - b.effective;
        case "price-desc":
          return b.effective - a.effective;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          // featured: featured → bestSeller → name
          return (
            Number(b.featured) - Number(a.featured) ||
            Number(b.bestSeller) - Number(a.bestSeller) ||
            a.name.localeCompare(b.name)
          );
      }
    });
    return list;
  }, [items, query, category, sort, maxPrice]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu…"
            aria-label="Search the menu"
            className="h-11 w-full rounded-xl border border-line bg-ink-900 pl-9 pr-3 text-sm text-fog-100 outline-none transition focus:border-fog-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-fog-500" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort menu"
            className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-sm text-fog-200 outline-none"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-sm text-fog-200 outline-none"
            aria-label="Max price"
          >
            <option value={0}>Any price</option>
            <option value={Math.ceil(priceCeiling / 2)}>Under £{Math.ceil(priceCeiling / 2)}</option>
            <option value={Math.ceil(priceCeiling * 0.75)}>Under £{Math.ceil(priceCeiling * 0.75)}</option>
            <option value={priceCeiling}>Under £{priceCeiling}</option>
          </select>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-ink-900/40 p-10 text-center text-sm text-fog-500">
          No items match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} slug={slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition",
        active ? "border-gold-400/50 bg-gold-400/10 text-gold-200" : "border-line bg-ink-900 text-fog-400 hover:text-fog-100"
      )}
    >
      {children}
    </button>
  );
}
