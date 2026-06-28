"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Variant } from "@/lib/validations/product";

interface VariantsEditorProps {
  value: Variant[];
  onChange: (variants: Variant[]) => void;
}

/**
 * Editor for product variants (e.g. Size · Large, Spicy Level · Hot). Each
 * variant carries an optional price adjustment, stock count and SKU.
 */
export function VariantsEditor({ value, onChange }: VariantsEditorProps) {
  function add() {
    onChange([...value, { name: "", priceAdjustment: 0, stock: null, sku: "" }]);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function set(i: number, patch: Partial<Variant>) {
    onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  return (
    <div className="space-y-3">
      {value.map((variant, i) => (
        <div key={i} className="rounded-xl border border-line bg-ink-850 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={variant.name}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder="Variant (e.g. Large, Hot, 330ml)"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label="Remove variant"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-fog-500">Price adj. (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={variant.priceAdjustment}
                onChange={(e) => set(i, { priceAdjustment: Number(e.target.value) })}
                className="h-9"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-fog-500">Stock</Label>
              <Input
                type="number"
                min="0"
                value={variant.stock ?? ""}
                onChange={(e) =>
                  set(i, { stock: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="h-9"
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-fog-500">SKU</Label>
              <Input
                value={variant.sku ?? ""}
                onChange={(e) => set(i, { sku: e.target.value })}
                className="h-9"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add variant
      </Button>
    </div>
  );
}
