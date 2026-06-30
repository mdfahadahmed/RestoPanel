"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { PosDrawer } from "./PosTerminal";
import {
  openDrawerAction,
  closeDrawerAction,
  drawerMovementAction,
} from "./actions";

export function DrawerPanel({ drawer, currency }: { drawer: PosDrawer | null; currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [float, setFloat] = useState("100");
  const [counted, setCounted] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const money = (n: number) => formatCurrency(n, currency);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Something went wrong");
    else {
      toast.success(success);
      router.refresh();
    }
  }

  if (!drawer) {
    return (
      <div className="rounded-2xl border border-line bg-ink-900/50 p-4">
        <div className="flex items-center gap-2 text-fog-200">
          <Wallet className="size-4 text-violet-300" />
          <span className="font-semibold">Cash drawer</span>
        </div>
        <p className="mt-1 text-sm text-fog-400">No drawer open. Start a session with a float.</p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={float}
            onChange={(e) => setFloat(e.target.value)}
            aria-label="Opening float"
            className="h-9"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => run(() => openDrawerAction(Number(float)), "Drawer opened")}
          >
            Open
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-fog-200">
          <Wallet className="size-4 text-emerald-300" />
          <span className="font-semibold">Cash drawer</span>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">Open</span>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-fog-400">Opening float</dt>
          <dd className="text-fog-100">{money(drawer.openingFloat)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fog-400">Expected cash</dt>
          <dd className="font-semibold text-fog-100">{money(drawer.expected)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={moveAmount}
          onChange={(e) => setMoveAmount(e.target.value)}
          placeholder="Amount"
          aria-label="Pay in / out amount"
          className="h-9"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !moveAmount}
          onClick={() =>
            run(
              () => drawerMovementAction({ sessionId: drawer.sessionId, type: "PAY_IN", amount: Number(moveAmount) }),
              "Cash paid in"
            ).then(() => setMoveAmount(""))
          }
        >
          <ArrowDownToLine className="size-4" /> In
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !moveAmount}
          onClick={() =>
            run(
              () => drawerMovementAction({ sessionId: drawer.sessionId, type: "PAY_OUT", amount: Number(moveAmount) }),
              "Cash paid out"
            ).then(() => setMoveAmount(""))
          }
        >
          <ArrowUpFromLine className="size-4" /> Out
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder="Counted cash"
          aria-label="Counted cash at close"
          className="h-9"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || counted === ""}
          onClick={() =>
            run(async () => {
              const res = await closeDrawerAction({ sessionId: drawer.sessionId, countedCash: Number(counted) });
              if (res.ok) {
                toast.message(
                  `Variance ${money(res.data?.variance ?? 0)}`,
                  { description: res.data && res.data.variance === 0 ? "Balanced" : "Counted vs expected" }
                );
              }
              return res;
            }, "Drawer closed")
          }
        >
          <Lock className="size-4" /> Close
        </Button>
      </div>
    </div>
  );
}
