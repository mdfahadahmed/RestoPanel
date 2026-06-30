"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Trash2, SplitSquareHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  computeChange,
  splitEqually,
  sumTenders,
  type PosPaymentMethod,
  type TenderInput,
} from "@/lib/pos/shared";

interface DraftTender {
  method: PosPaymentMethod;
  amount: number;
  tendered?: number;
  cardLast4?: string;
}

interface TenderDialogProps {
  open: boolean;
  onClose: () => void;
  total: number;
  currency: string;
  busy: boolean;
  onConfirm: (tenders: TenderInput[]) => void;
}

export function TenderDialog({ open, onClose, total, currency, busy, onConfirm }: TenderDialogProps) {
  const [tenders, setTenders] = useState<DraftTender[]>([]);
  const [splitN, setSplitN] = useState(2);

  const money = (n: number) => formatCurrency(n, currency);
  const paid = useMemo(() => sumTenders(tenders), [tenders]);
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const change = useMemo(() => {
    const cashTendered = tenders.reduce((s, t) => s + (t.method === "CASH" ? t.tendered ?? t.amount : 0), 0);
    const cashApplied = tenders.reduce((s, t) => s + (t.method === "CASH" ? t.amount : 0), 0);
    return computeChange(cashTendered, cashApplied);
  }, [tenders]);

  function addTender(method: PosPaymentMethod) {
    if (remaining <= 0) return;
    setTenders((prev) => [
      ...prev,
      method === "CASH"
        ? { method, amount: remaining, tendered: remaining }
        : { method, amount: remaining },
    ]);
  }

  function splitEqual() {
    const parts = splitEqually(total, splitN);
    setTenders(parts.map((amount) => ({ method: "CARD", amount })));
  }

  function update(i: number, patch: Partial<DraftTender>) {
    setTenders((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function remove(i: number) {
    setTenders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function confirm() {
    const payload: TenderInput[] = tenders.map((t) => ({
      method: t.method,
      amount: t.amount,
      tendered: t.method === "CASH" ? t.tendered ?? t.amount : undefined,
      cardLast4: t.cardLast4 || undefined,
    }));
    onConfirm(payload);
  }

  const covered = paid + 0.0001 >= total;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>Total due {money(total)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => addTender("CASH")} disabled={remaining <= 0}>
            <Banknote className="size-4" /> Cash
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addTender("CARD")} disabled={remaining <= 0}>
            <CreditCard className="size-4" /> Card
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Input
              type="number"
              min={2}
              max={10}
              value={splitN}
              onChange={(e) => setSplitN(Math.max(2, Math.min(10, Number(e.target.value) || 2)))}
              aria-label="Number of ways to split"
              className="h-8 w-16"
            />
            <Button variant="outline" size="sm" onClick={splitEqual}>
              <SplitSquareHorizontal className="size-4" /> Split
            </Button>
          </div>
        </div>

        <ul className="space-y-2">
          {tenders.length === 0 && (
            <li className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-fog-500">
              Add a cash or card tender, or split the bill.
            </li>
          )}
          {tenders.map((t, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-line bg-ink-850 p-2">
              <span className="flex items-center gap-1 text-sm font-medium text-fog-200">
                {t.method === "CASH" ? <Banknote className="size-4" /> : <CreditCard className="size-4" />}
                {t.method === "CASH" ? "Cash" : t.method === "CARD" ? "Card" : "Online"}
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={t.amount}
                onChange={(e) => update(i, { amount: Math.max(0, Number(e.target.value) || 0) })}
                aria-label="Amount"
                className="h-8 w-24"
              />
              {t.method === "CASH" && (
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={t.tendered ?? t.amount}
                  onChange={(e) => update(i, { tendered: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Cash given"
                  placeholder="given"
                  className="h-8 w-24"
                />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove tender"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-fog-400 hover:bg-ink-800 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-1 rounded-xl border border-line bg-ink-950/60 p-3 text-sm">
          <Row label="Paid" value={money(paid)} />
          <Row label="Remaining" value={money(remaining)} accent={remaining > 0 ? "text-amber-300" : "text-emerald-300"} />
          {change > 0 && <Row label="Change" value={money(change)} accent="text-gold-300" />}
        </div>

        <Button variant="primary" disabled={!covered || busy} onClick={confirm}>
          {busy ? "Processing…" : `Charge ${money(total)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-fog-400">{label}</span>
      <span className={accent ?? "text-fog-100"}>{value}</span>
    </div>
  );
}
