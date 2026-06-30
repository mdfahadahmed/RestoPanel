"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { MemberRow } from "./LoyaltyClient";
import { adjustCustomerPoints, redeemCustomerPoints, redeemCustomerCashback } from "./actions";

interface Props {
  member: MemberRow | null;
  currency: string;
  onClose: () => void;
}

export function LoyaltyMemberDialog({ member, currency, onClose }: Props) {
  const router = useRouter();
  const [adjust, setAdjust] = useState("");
  const [redeem, setRedeem] = useState("");
  const [cashback, setCashback] = useState("");
  const [busy, setBusy] = useState(false);
  const money = (n: number) => formatCurrency(n, currency);

  if (!member) return null;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Something went wrong");
    else {
      toast.success(success);
      router.refresh();
    }
    return res;
  }

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.name ?? member.phone}</DialogTitle>
          <DialogDescription>
            {member.vipTier} · {member.loyaltyPoints} pts · {money(member.cashbackBalance)} cashback
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ly-adjust">Adjust points (+/−)</Label>
            <div className="flex gap-2">
              <Input
                id="ly-adjust"
                type="number"
                value={adjust}
                onChange={(e) => setAdjust(e.target.value)}
                placeholder="e.g. 100 or -50"
              />
              <Button
                variant="secondary"
                disabled={busy || !adjust}
                onClick={() =>
                  run(() => adjustCustomerPoints({ customerId: member.id, points: Number(adjust) }), "Points adjusted").then(
                    (r) => r.ok && setAdjust("")
                  )
                }
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ly-redeem">Redeem points → coupon</Label>
            <div className="flex gap-2">
              <Input
                id="ly-redeem"
                type="number"
                min={1}
                value={redeem}
                onChange={(e) => setRedeem(e.target.value)}
                placeholder={`up to ${member.loyaltyPoints}`}
              />
              <Button
                variant="primary"
                disabled={busy || !redeem}
                onClick={() =>
                  run(async () => {
                    const r = await redeemCustomerPoints({ customerId: member.id, points: Number(redeem) });
                    if (r.ok && r.data) toast.message(`Coupon ${r.data.code}`, { description: `${money(r.data.value)} off` });
                    return r;
                  }, "Coupon created").then((r) => r.ok && setRedeem(""))
                }
              >
                Redeem
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ly-cashback">Redeem cashback → coupon</Label>
            <div className="flex gap-2">
              <Input
                id="ly-cashback"
                type="number"
                min={0}
                step="0.01"
                value={cashback}
                onChange={(e) => setCashback(e.target.value)}
                placeholder={`up to ${money(member.cashbackBalance)}`}
              />
              <Button
                variant="primary"
                disabled={busy || !cashback}
                onClick={() =>
                  run(async () => {
                    const r = await redeemCustomerCashback({ customerId: member.id, amount: Number(cashback) });
                    if (r.ok && r.data) toast.message(`Coupon ${r.data.code}`, { description: `${money(r.data.value)} off` });
                    return r;
                  }, "Cashback coupon created").then((r) => r.ok && setCashback(""))
                }
              >
                Redeem
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
