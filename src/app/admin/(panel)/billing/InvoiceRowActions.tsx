"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markInvoicePaidAction, voidInvoiceAction } from "./actions";

export function InvoiceRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setPending(true);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      toast.success(ok);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label="Invoice actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "PAID" && (
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); run(() => markInvoicePaidAction(id), "Invoice marked paid"); }}
          >
            <CheckCircle2 className="h-4 w-4" /> Mark paid
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => { e.preventDefault(); run(() => voidInvoiceAction(id), "Invoice voided"); }}
        >
          <Ban className="h-4 w-4" /> Void
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
