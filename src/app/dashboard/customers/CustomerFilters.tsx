"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomerFilters({ tags }: { tags: string[] }) {
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

  const filterKeys = ["status", "tag", "from", "to", "minOrders", "minSpend", "sort"];
  const hasFilters = filterKeys.some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-36">
        <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select value={params.get("tag") ?? "all"} onValueChange={(v) => setParam("tag", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any tag</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <Select value={params.get("sort") ?? "newest"} onValueChange={(v) => setParam("sort", v, "newest")}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="orders">Most orders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Input
        type="number"
        min="0"
        aria-label="Minimum orders"
        placeholder="Min orders"
        className="h-9 w-28"
        defaultValue={params.get("minOrders") ?? ""}
        onBlur={(e) => setParam("minOrders", e.target.value, "")}
      />
      <Input
        type="number"
        min="0"
        aria-label="Minimum spending"
        placeholder="Min spend £"
        className="h-9 w-28"
        defaultValue={params.get("minSpend") ?? ""}
        onBlur={(e) => setParam("minSpend", e.target.value, "")}
      />

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Joined from"
          className="h-9 w-[9.5rem]"
          value={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value, "")}
        />
        <span className="text-xs text-fog-500">→</span>
        <Input
          type="date"
          aria-label="Joined to"
          className="h-9 w-[9.5rem]"
          value={params.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value, "")}
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname + (params.get("q") ? `?q=${params.get("q")}` : ""))}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
