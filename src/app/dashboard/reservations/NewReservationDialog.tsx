"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localDateKey } from "@/lib/utils";
import { createReservationAction } from "./actions";

export function NewReservationDialog({ tables }: { tables: { id: string; name: string; capacity: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [f, setF] = useState({
    name: "", phone: "", email: "", date: "", time: "19:00", partySize: "2",
    tableId: "auto", notes: "", status: "CONFIRMED" as "CONFIRMED" | "PENDING",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function reset() {
    setF({ name: "", phone: "", email: "", date: "", time: "19:00", partySize: "2", tableId: "auto", notes: "", status: "CONFIRMED" });
    setErrors({});
  }

  async function submit() {
    setPending(true); setErrors({});
    try {
      const res = await createReservationAction({
        name: f.name, phone: f.phone, email: f.email, date: f.date, time: f.time,
        partySize: Number(f.partySize), tableId: f.tableId === "auto" ? "" : f.tableId,
        notes: f.notes, status: f.status,
      });
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(`Reservation created (${res.data?.reference})`);
      reset(); setOpen(false); router.refresh();
    } finally { setPending(false); }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button variant="primary"><Plus className="h-4 w-4" /> New reservation</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>Add a walk-in or phone booking.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} />{err("name") && <p className="text-xs text-rose-400">{err("name")}</p>}</div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} />{err("phone") && <p className="text-xs text-rose-400">{err("phone")}</p>}</div>
          <div className="space-y-1.5"><Label>Email (optional)</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" min={localDateKey()} value={f.date} onChange={(e) => set("date", e.target.value)} />{err("date") && <p className="text-xs text-rose-400">{err("date")}</p>}</div>
          <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Party size</Label><Input type="number" min={1} value={f.partySize} onChange={(e) => set("partySize", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tables.length > 0 && (
            <div className="space-y-1.5 col-span-2">
              <Label>Table</Label>
              <Select value={f.tableId} onValueChange={(v) => set("tableId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-assign</SelectItem>
                  {tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.capacity})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={pending || !f.name.trim() || !f.phone.trim() || !f.date}>{pending ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
