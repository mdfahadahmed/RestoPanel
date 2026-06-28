"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentMethod, PaymentStatus } from "@/lib/validations/order";
import { updatePayment, updateRestaurantNotes } from "./actions";

export function OrderPaymentControl({
  id,
  paymentStatus,
  paymentMethod,
}: {
  id: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>(paymentStatus);
  const [method, setMethod] = useState<PaymentMethod>(paymentMethod);
  const [pending, setPending] = useState(false);
  const dirty = status !== paymentStatus || method !== paymentMethod;

  async function save() {
    setPending(true);
    try {
      const res = await updatePayment({ id, paymentStatus: status, paymentMethod: method });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-fog-500">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-fog-500">Method</label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
              <SelectItem value="ONLINE">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={!dirty || pending}>
        {pending ? "Saving…" : "Update payment"}
      </Button>
    </div>
  );
}

export function OrderNotesEditor({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState(value);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await updateRestaurantNotes({ id, restaurantNotes: notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Notes saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Internal note for your team (not shown to the customer)…"
      />
      <Button size="sm" variant="outline" onClick={save} disabled={notes === value || pending}>
        {pending ? "Saving…" : "Save note"}
      </Button>
    </div>
  );
}
