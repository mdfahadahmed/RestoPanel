"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, Eye, ArrowRight, BadgeDollarSign, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_TRANSITIONS, type OrderStatus, type PaymentStatus } from "@/lib/validations/order";
import { ORDER_STATUS_META } from "./status";
import { updateOrderStatus, updatePayment } from "./actions";

interface OrderRowActionsProps {
  order: { id: string; status: OrderStatus; paymentStatus: PaymentStatus };
}

export function OrderRowActions({ order }: OrderRowActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // The primary forward step is the first allowed transition that isn't a cancel.
  const forward = STATUS_TRANSITIONS[order.status].find(
    (s) => s !== "CANCELLED" && s !== "REJECTED" && s !== "REFUNDED"
  );
  const canCancel = STATUS_TRANSITIONS[order.status].includes("CANCELLED");

  async function setStatus(status: OrderStatus, msg: string) {
    setPending(true);
    try {
      const res = await updateOrderStatus({ id: order.id, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(msg);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function markPaid() {
    setPending(true);
    try {
      const res = await updatePayment({ id: order.id, paymentStatus: "PAID" });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked as paid");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Order actions" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/orders/${order.id}`}>
            <Eye className="h-4 w-4" /> View details
          </Link>
        </DropdownMenuItem>
        {forward && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void setStatus(forward, `Marked ${ORDER_STATUS_META[forward].label.toLowerCase()}`);
            }}
          >
            <ArrowRight className="h-4 w-4" /> Mark {ORDER_STATUS_META[forward].label.toLowerCase()}
          </DropdownMenuItem>
        )}
        {order.paymentStatus === "UNPAID" && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void markPaid();
            }}
          >
            <BadgeDollarSign className="h-4 w-4" /> Mark as paid
          </DropdownMenuItem>
        )}
        {canCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                void setStatus("CANCELLED", "Order cancelled");
              }}
            >
              <XCircle className="h-4 w-4" /> Cancel order
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
