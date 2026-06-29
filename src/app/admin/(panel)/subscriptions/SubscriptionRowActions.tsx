"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, PlayCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setSubscriptionStatusAction } from "./actions";

export function SubscriptionRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function set(status: "ACTIVE" | "PAST_DUE" | "CANCELED", label: string) {
    setPending(true);
    try {
      const res = await setSubscriptionStatusAction(id, status);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(label);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label="Subscription actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); set("ACTIVE", "Marked active"); }}>
          <PlayCircle className="h-4 w-4" /> Mark active
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); set("PAST_DUE", "Marked past due"); }}>
          <AlertTriangle className="h-4 w-4" /> Mark past due
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => { e.preventDefault(); set("CANCELED", "Subscription canceled"); }}
        >
          <XCircle className="h-4 w-4" /> Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
