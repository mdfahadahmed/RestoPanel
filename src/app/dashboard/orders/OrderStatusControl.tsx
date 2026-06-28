"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_TRANSITIONS, type OrderStatus } from "@/lib/validations/order";
import { ORDER_STATUS_META } from "./status";
import { updateOrderStatus } from "./actions";

/** Status workflow control: shows the current status and the allowed next steps. */
export function OrderStatusControl({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const next = STATUS_TRANSITIONS[status];

  async function move(target: OrderStatus) {
    setPending(target);
    try {
      const res = await updateOrderStatus({ id, status: target });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Order marked ${ORDER_STATUS_META[target].label.toLowerCase()}`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const meta = ORDER_STATUS_META[status];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-fog-500">Current status</span>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>
      {next.length === 0 ? (
        <p className="text-xs text-fog-500">This order has reached a final state.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next.map((target) => {
            const isDestructive = target === "CANCELLED" || target === "REJECTED";
            return (
              <Button
                key={target}
                size="sm"
                variant={isDestructive ? "outline" : "default"}
                disabled={pending !== null}
                onClick={() => move(target)}
              >
                {pending === target ? "Saving…" : <>
                  <Check className="h-3.5 w-3.5" /> {ORDER_STATUS_META[target].label}
                </>}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
