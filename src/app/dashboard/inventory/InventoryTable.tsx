"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, UtensilsCrossed, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { updateStock } from "./actions";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  price: number;
  stockQuantity: number | null;
  stockStatus: StockStatus;
}

const STATUS_META: Record<StockStatus, { label: string; badge: "emerald" | "amber" | "rose" }> = {
  IN_STOCK: { label: "In stock", badge: "emerald" },
  LOW_STOCK: { label: "Low stock", badge: "amber" },
  OUT_OF_STOCK: { label: "Out of stock", badge: "rose" },
};

const LOW_THRESHOLD = 5;

/** Suggest a status from the quantity (0 → out, ≤5 → low, else in stock). */
function deriveStatus(qty: number | null): StockStatus {
  if (qty === null) return "IN_STOCK";
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= LOW_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
  // Local draft edits keyed by product id.
  const [drafts, setDrafts] = useState<
    Record<string, { qty: string; status: StockStatus }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && r.stockStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  function draftFor(r: InventoryRow) {
    return (
      drafts[r.id] ?? {
        qty: r.stockQuantity === null ? "" : String(r.stockQuantity),
        status: r.stockStatus,
      }
    );
  }

  function isDirty(r: InventoryRow) {
    const d = drafts[r.id];
    if (!d) return false;
    const origQty = r.stockQuantity === null ? "" : String(r.stockQuantity);
    return d.qty !== origQty || d.status !== r.stockStatus;
  }

  function setQty(r: InventoryRow, qty: string) {
    const parsed = qty === "" ? null : Number(qty);
    setDrafts((prev) => ({
      ...prev,
      [r.id]: {
        qty,
        // Auto-suggest a status as the quantity changes.
        status: Number.isFinite(parsed as number) || parsed === null
          ? deriveStatus(parsed)
          : draftFor(r).status,
      },
    }));
  }

  function setStatus(r: InventoryRow, status: StockStatus) {
    setDrafts((prev) => ({ ...prev, [r.id]: { ...draftFor(r), status } }));
  }

  function save(r: InventoryRow) {
    const d = draftFor(r);
    setSavingId(r.id);
    startTransition(async () => {
      const res = await updateStock({
        id: r.id,
        stockQuantity: d.qty === "" ? null : Number(d.qty),
        stockStatus: d.status,
      });
      if (res.ok) {
        toast.success(`Stock updated for ${r.name}`);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[r.id];
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setSavingId(null);
    });
  }

  const selectCls =
    "rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-fog-200 outline-none transition focus:border-violet-500/60";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            aria-label="Search inventory"
            className="w-full rounded-xl border border-line bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60"
          />
        </div>
        <select
          aria-label="Filter by stock status"
          className={selectCls}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | StockStatus)}
        >
          <option value="ALL">All stock</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No products"
          description="No products match your search. Add products in the Products module to manage their stock here."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/60 text-left text-xs uppercase tracking-wider text-fog-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => {
                  const d = draftFor(r);
                  const dirty = isDirty(r);
                  return (
                    <tr key={r.id} className="transition hover:bg-ink-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-850">
                            {r.imageUrl ? (
                              <Image src={r.imageUrl} alt={r.name} fill sizes="36px" className="object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center text-fog-600">
                                <UtensilsCrossed className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fog-100">{r.name}</p>
                            {r.categoryName && (
                              <p className="truncate text-xs text-fog-500">{r.categoryName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-fog-400">{r.sku || "—"}</td>
                      <td className="px-4 py-3 text-fog-300">{formatCurrency(r.price)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={d.qty}
                          onChange={(e) => setQty(r, e.target.value)}
                          aria-label={`Quantity for ${r.name}`}
                          placeholder="—"
                          className="w-24 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={d.status}
                          onChange={(e) => setStatus(r, e.target.value as StockStatus)}
                          aria-label={`Status for ${r.name}`}
                          className={selectCls}
                        >
                          <option value="IN_STOCK">In stock</option>
                          <option value="LOW_STOCK">Low stock</option>
                          <option value="OUT_OF_STOCK">Out of stock</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => save(r)}
                          disabled={!dirty || savingId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-fog-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {savingId === r.id ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const d = draftFor(r);
              const dirty = isDirty(r);
              return (
                <div key={r.id} className="rounded-2xl border border-line bg-ink-900/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-850">
                      {r.imageUrl ? (
                        <Image src={r.imageUrl} alt={r.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-fog-600">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fog-100">{r.name}</p>
                      <p className="truncate text-xs text-fog-500">
                        {(r.sku || "No SKU") + " · " + formatCurrency(r.price)}
                      </p>
                    </div>
                    <Badge variant={STATUS_META[d.status].badge}>{STATUS_META[d.status].label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={d.qty}
                      onChange={(e) => setQty(r, e.target.value)}
                      aria-label={`Quantity for ${r.name}`}
                      placeholder="Qty"
                      className="w-20 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
                    />
                    <select
                      value={d.status}
                      onChange={(e) => setStatus(r, e.target.value as StockStatus)}
                      aria-label={`Status for ${r.name}`}
                      className={selectCls + " flex-1"}
                    >
                      <option value="IN_STOCK">In stock</option>
                      <option value="LOW_STOCK">Low stock</option>
                      <option value="OUT_OF_STOCK">Out of stock</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => save(r)}
                      disabled={!dirty || savingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
