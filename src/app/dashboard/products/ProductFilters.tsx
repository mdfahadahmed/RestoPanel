"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductFiltersProps {
  categories: { id: string; name: string }[];
}

export function ProductFilters({ categories }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string, clearOn = "all") {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === clearOn) sp.delete(key);
    else sp.set(key, value);
    sp.delete("page");
    router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <Select value={params.get("category") ?? "all"} onValueChange={(v) => setParam("category", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select value={params.get("availability") ?? "all"} onValueChange={(v) => setParam("availability", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any availability</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select value={params.get("stock") ?? "all"} onValueChange={(v) => setParam("stock", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any stock</SelectItem>
            <SelectItem value="IN_STOCK">In stock</SelectItem>
            <SelectItem value="LOW_STOCK">Low stock</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select value={params.get("flag") ?? "all"} onValueChange={(v) => setParam("flag", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Flags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="bestSeller">Best sellers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select
          value={params.get("sort") ?? "newest"}
          onValueChange={(v) => setParam("sort", v, "newest")}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="price-asc">Price (low → high)</SelectItem>
            <SelectItem value="price-desc">Price (high → low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-28">
        <Select value={params.get("view") ?? "active"} onValueChange={(v) => setParam("view", v === "active" ? "all" : v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
