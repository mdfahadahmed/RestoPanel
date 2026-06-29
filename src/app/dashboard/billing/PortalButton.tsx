"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the Stripe Billing Portal (manage card, download invoices). */
export function PortalButton() {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not open billing portal");
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={open} disabled={busy}>
      <CreditCard className="h-4 w-4" /> {busy ? "Opening…" : "Manage payment method"}
    </Button>
  );
}
