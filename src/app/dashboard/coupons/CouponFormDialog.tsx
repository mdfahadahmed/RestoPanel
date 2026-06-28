"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CouponType } from "@/lib/validations/coupon";
import { createCoupon, updateCoupon } from "./actions";

export interface CouponFormValues {
  id: string;
  code: string;
  type: CouponType;
  value: string;
  minimumOrder: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface Props {
  coupon?: CouponFormValues;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type FieldErrors = Record<string, string[] | undefined>;

const EMPTY: Omit<CouponFormValues, "id"> = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  minimumOrder: "0",
  usageLimit: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export function CouponFormDialog({ coupon, trigger, open: controlledOpen, onOpenChange }: Props) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setInternalOpen(v));

  const isEdit = Boolean(coupon);
  const [form, setForm] = useState<Omit<CouponFormValues, "id">>(coupon ?? EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(coupon ?? EMPTY);
      setErrors({});
    }
  }, [open, coupon]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload = {
      ...(coupon ? { id: coupon.id } : {}),
      code: form.code,
      type: form.type,
      value: form.value === "" ? 0 : Number(form.value),
      minimumOrder: form.minimumOrder === "" ? 0 : Number(form.minimumOrder),
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      isActive: form.isActive,
    };
    setPending(true);
    try {
      const res = isEdit ? await updateCoupon(payload) : await createCoupon(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Coupon updated" : "Coupon created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit coupon" : "New coupon"}</DialogTitle>
          <DialogDescription>Offer a discount customers can redeem at checkout.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={32} autoFocus className="font-mono" />
              {err("code") && <p className="text-xs text-rose-400">{err("code")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as CouponType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="value">{form.type === "PERCENTAGE" ? "Discount (%)" : "Discount amount"}</Label>
              <Input id="value" type="number" min="0" step="0.01" value={form.value} onChange={(e) => set("value", e.target.value)} />
              {err("value") && <p className="text-xs text-rose-400">{err("value")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Minimum order</Label>
              <Input id="min" type="number" min="0" step="0.01" value={form.minimumOrder} onChange={(e) => set("minimumOrder", e.target.value)} />
              {err("minimumOrder") && <p className="text-xs text-rose-400">{err("minimumOrder")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="limit">Usage limit</Label>
              <Input id="limit" type="number" min="1" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} placeholder="Unlimited" />
              {err("usageLimit") && <p className="text-xs text-rose-400">{err("usageLimit")}</p>}
            </div>
            <div className="flex items-end justify-between rounded-xl border border-line bg-ink-850 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-fog-200">Active</p>
                <p className="text-xs text-fog-500">Redeemable now</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="starts">Start date</Label>
              <Input id="starts" type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ends">End date</Label>
              <Input id="ends" type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              {err("endsAt") && <p className="text-xs text-rose-400">{err("endsAt")}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : isEdit ? "Save changes" : "Create coupon"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
