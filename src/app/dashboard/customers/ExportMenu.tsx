"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Exports the current (filtered) customer list as CSV or Excel. */
export function ExportMenu() {
  const params = useSearchParams();

  function href(format: "csv" | "xlsx") {
    const sp = new URLSearchParams(params.toString());
    sp.delete("page");
    sp.set("format", format);
    return `/api/customers/export?${sp.toString()}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href("csv")} download>
            <FileText className="h-4 w-4" /> CSV (.csv)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            <Sheet className="h-4 w-4" /> Excel (.xls)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
