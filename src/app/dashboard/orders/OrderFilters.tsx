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
import { ORDER_STATUS_META } from "./status";

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_META) as [keyof typeof ORDER_STATUS_META, { label: string }][];

export function OrderFilters() {
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

  const hasFilters = ["status", "payment", "method", "type", "from", "to", "sort"].some((k) =>
    params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <Select value={params.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {STATUS_OPTIONS.map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-36">
        <Select value={params.get("payment") ?? "all"} onValueChange={(v) => setParam("payment", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any payment</SelectItem>
            <SelectItem value="UNPAID">Unpaid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select value={params.get("method") ?? "all"} onValueChange={(v) => setParam("method", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any method</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-32">
        <Select value={params.get("type") ?? "all"} onValueChange={(v) => setParam("type", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            <SelectItem value="DELIVERY">Delivery</SelectItem>
            <SelectItem value="PICKUP">Takeaway</SelectItem>
            <SelectItem value="DINE_IN">Dine in</SelectItem>
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
            <SelectItem value="total-desc">Total (high → low)</SelectItem>
            <SelectItem value="total-asc">Total (low → high)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date"
          className="h-9 w-[9.5rem]"
          value={params.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value, "")}
        />
        <span className="text-xs text-fog-500">→</span>
        <Input
          type="date"
          aria-label="To date"
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
