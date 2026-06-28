"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReviewFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "all") sp.delete(key);
    else sp.set(key, value);
    sp.delete("page");
    router.push(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-36">
        <Select value={params.get("rating") ?? "all"} onValueChange={(v) => setParam("rating", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any rating</SelectItem>
            <SelectItem value="5">★★★★★ (5)</SelectItem>
            <SelectItem value="4">★★★★ (4)</SelectItem>
            <SelectItem value="3">★★★ (3)</SelectItem>
            <SelectItem value="2">★★ (2)</SelectItem>
            <SelectItem value="1">★ (1)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <Select value={params.get("visibility") ?? "all"} onValueChange={(v) => setParam("visibility", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviews</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
