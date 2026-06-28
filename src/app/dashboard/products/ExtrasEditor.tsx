"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Extra } from "@/lib/validations/product";

interface ExtrasEditorProps {
  value: Extra[];
  onChange: (extras: Extra[]) => void;
}

/** Editor for add-on extras (e.g. Cheese +£1.00). Each extra can be toggled active. */
export function ExtrasEditor({ value, onChange }: ExtrasEditorProps) {
  function add() {
    onChange([...value, { name: "", price: 0, isActive: true }]);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function set(i: number, patch: Partial<Extra>) {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  return (
    <div className="space-y-2">
      {value.map((extra, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={extra.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="Extra (e.g. Extra cheese)"
            className="h-9"
          />
          <div className="relative w-28 shrink-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-fog-500">
              +£
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={extra.price}
              onChange={(e) => set(i, { price: Number(e.target.value) })}
              className="h-9 pl-7"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5" title="Active">
            <Switch
              checked={extra.isActive}
              onCheckedChange={(v) => set(i, { isActive: v })}
              aria-label={`${extra.name || "Extra"} active`}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            aria-label="Remove extra"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add extra
      </Button>
    </div>
  );
}
