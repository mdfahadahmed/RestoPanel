"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Armchair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createTableAction, updateTableAction, deleteTableAction } from "../actions";

export interface TableRowData {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  isActive: boolean;
  position: number;
}

export function TablesManager({ tables }: { tables: TableRowData[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TableRowData | null>(null);
  const [open, setOpen] = useState(false);

  function startNew() {
    setEditing({ id: "", name: "", capacity: 2, location: "", isActive: true, position: tables.length });
    setOpen(true);
  }

  async function remove(id: string) {
    const res = await deleteTableAction(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Table deleted");
    router.refresh();
  }

  const totalSeats = tables.filter((t) => t.isActive).reduce((s, t) => s + t.capacity, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Tables <span className="text-sm font-normal text-fog-500">· {totalSeats} seats</span></CardTitle>
        <Button size="sm" variant="primary" onClick={startNew}><Plus className="h-4 w-4" /> Add table</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {tables.length === 0 ? (
          <EmptyState
            icon={Armchair}
            title="No tables yet"
            description="Add tables so bookings get assigned automatically. Without tables, reservations use a per-slot capacity (set in Settings)."
            className="border-0"
          />
        ) : (
          tables.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-850 text-sm font-medium">{t.capacity}</span>
                <div>
                  <p className="font-medium">{t.name} {!t.isActive && <Badge variant="outline">inactive</Badge>}</p>
                  <p className="text-xs text-fog-500">{t.location || "—"} · seats {t.capacity}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {editing && <TableDialog table={editing} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function TableDialog({ table, open, onOpenChange }: { table: TableRowData; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [form, setForm] = useState(table);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const payload = { name: form.name, capacity: form.capacity, location: form.location ?? "", isActive: form.isActive, position: form.position };
      const res = form.id ? await updateTableAction(form.id, payload) : await createTableAction(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Table saved");
      onOpenChange(false);
      router.refresh();
    } finally { setPending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? "Edit table" : "New table"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T1" /></div>
          <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Location (optional)</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Patio, Bar…" /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-fog-300">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active (bookable)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={pending || !form.name.trim()}>{pending ? "Saving…" : "Save table"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
