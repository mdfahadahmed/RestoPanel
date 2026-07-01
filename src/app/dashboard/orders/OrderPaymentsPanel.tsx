"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, ReceiptText, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { refundOrder, markOrderPaidAction } from "./actions";

type TxnStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface PaymentTxn {
  id: string;
  kind: "SALE" | "REFUND";
  method: string;
  provider: string | null;
  status: TxnStatus;
  amount: number;
  cardLast4: string | null;
  failureReason: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<TxnStatus, "emerald" | "amber" | "rose" | "outline"> = {
  SUCCEEDED: "emerald",
  PENDING: "amber",
  FAILED: "rose",
  REFUNDED: "outline",
};

export function OrderPaymentsPanel({
  id,
  invoiceNumber,
  transactions,
}: {
  id: string;
  invoiceNumber: string | null;
  transactions: PaymentTxn[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const netPaid = useMemo(
    () =>
      transactions.reduce((sum, t) => {
        if (t.status !== "SUCCEEDED") return sum;
        return sum + (t.kind === "REFUND" ? -t.amount : t.amount);
      }, 0),
    [transactions]
  );
  const refunded = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "REFUND" && t.status === "SUCCEEDED")
        .reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const hasFailed = transactions.some((t) => t.status === "FAILED");

  const [refundAmount, setRefundAmount] = useState("");

  function doRefund() {
    const amt = refundAmount.trim() === "" ? undefined : Number(refundAmount);
    if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0)) {
      toast.error("Enter a valid refund amount");
      return;
    }
    startTransition(async () => {
      const res = await refundOrder({ id, amount: amt });
      if (res.ok) {
        toast.success(`Refunded ${formatCurrency(res.data!.refunded)}`);
        setRefundAmount("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function doMarkPaid() {
    startTransition(async () => {
      const res = await markOrderPaidAction({ id });
      if (res.ok) {
        toast.success("Order marked as paid");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-fog-500">Net received: </span>
          <span className="font-semibold text-fog-100">{formatCurrency(netPaid)}</span>
        </div>
        {refunded > 0 && (
          <div>
            <span className="text-fog-500">Refunded: </span>
            <span className="font-medium text-fog-300">{formatCurrency(refunded)}</span>
          </div>
        )}
        {invoiceNumber && (
          <Link
            href={`/print/orders/${id}/invoice`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-violet-300 hover:text-violet-200"
          >
            <ReceiptText className="h-3.5 w-3.5" /> {invoiceNumber}
          </Link>
        )}
      </div>

      {/* Transactions */}
      {transactions.length === 0 ? (
        <p className="text-sm text-fog-500">No payment transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-900/40 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fog-100">
                    {t.kind === "REFUND" ? "Refund" : "Payment"}
                  </span>
                  <Badge variant={STATUS_BADGE[t.status]}>{t.status.toLowerCase()}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-fog-500">
                  {t.method}
                  {t.provider ? ` · ${t.provider}` : ""}
                  {t.cardLast4 ? ` · ••${t.cardLast4}` : ""} · {formatDate(t.createdAt)}
                </p>
                {t.failureReason && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-rose-300">
                    <AlertTriangle className="h-3 w-3" /> {t.failureReason}
                  </p>
                )}
              </div>
              <span
                className={
                  t.kind === "REFUND" ? "shrink-0 text-fog-400" : "shrink-0 font-medium text-fog-100"
                }
              >
                {t.kind === "REFUND" ? "−" : ""}
                {formatCurrency(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="space-y-3 border-t border-line pt-3">
        {netPaid <= 0 ? (
          <Button onClick={doMarkPaid} disabled={pending} className="w-full">
            <CheckCircle2 className="h-4 w-4" /> Mark as paid
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Full (${formatCurrency(netPaid)})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                aria-label="Refund amount"
              />
              <Button
                variant="outline"
                onClick={doRefund}
                disabled={pending}
                className="shrink-0"
              >
                <RotateCcw className="h-4 w-4" /> Refund
              </Button>
            </div>
            <p className="text-xs text-fog-500">
              Leave blank to refund the full amount. Refunds are processed through the
              original payment provider.
            </p>
          </div>
        )}
        {hasFailed && netPaid <= 0 && (
          <p className="text-xs text-amber-300">
            A previous payment attempt failed. The customer can retry, or you can mark
            the order paid once settled.
          </p>
        )}
      </div>
    </div>
  );
}
