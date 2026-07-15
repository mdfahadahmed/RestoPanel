"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal, Check, X, CalendarClock, Utensils, CheckCheck, UserX, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localDateKey } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  approveReservationAction, rejectReservationAction, rescheduleReservationAction, setStatusAction,
} from "./actions";

export interface RowReservation {
  id: string;
  status: string;
  date: string; // ISO
  time: string; // HH:MM
  dateOnly: string; // YYYY-MM-DD
  partySize: number;
  tableId: string | null;
}

export function ReservationRowActions({
  reservation,
  tables,
}: {
  reservation: RowReservation;
  tables: { id: string; name: string; capacity: number }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const isActive = ["PENDING", "CONFIRMED", "SEATED"].includes(reservation.status);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Something went wrong"); return false; }
      toast.success(ok);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Reservation actions" disabled={busy}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {reservation.status === "PENDING" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); run(() => approveReservationAction(reservation.id), "Reservation approved"); }}>
              <Check className="h-4 w-4" /> Approve
            </DropdownMenuItem>
          )}
          {reservation.status === "PENDING" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRejectOpen(true); }}>
              <X className="h-4 w-4" /> Decline
            </DropdownMenuItem>
          )}
          {reservation.status === "CONFIRMED" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); run(() => setStatusAction(reservation.id, "SEATED"), "Marked seated"); }}>
              <Utensils className="h-4 w-4" /> Mark seated
            </DropdownMenuItem>
          )}
          {reservation.status === "SEATED" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); run(() => setStatusAction(reservation.id, "COMPLETED"), "Completed"); }}>
              <CheckCheck className="h-4 w-4" /> Mark completed
            </DropdownMenuItem>
          )}
          {(reservation.status === "CONFIRMED" || reservation.status === "PENDING") && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); run(() => setStatusAction(reservation.id, "NO_SHOW"), "Marked no-show"); }}>
              <UserX className="h-4 w-4" /> No-show
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setRescheduleOpen(true); }}>
              <CalendarClock className="h-4 w-4" /> Reschedule
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); run(() => setStatusAction(reservation.id, "CANCELLED"), "Cancelled"); }}>
              <Ban className="h-4 w-4" /> Cancel
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RejectDialog id={reservation.id} open={rejectOpen} onOpenChange={setRejectOpen} onDone={() => router.refresh()} />
      <RescheduleDialog reservation={reservation} tables={tables} open={rescheduleOpen} onOpenChange={setRescheduleOpen} onDone={() => router.refresh()} />
    </>
  );
}

function RejectDialog({ id, open, onOpenChange, onDone }: { id: string; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Decline reservation</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason (optional, shared with the guest)</Label>
          <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fully booked at that time" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await rejectReservationAction(id, reason || undefined);
                if (!res.ok) { toast.error(res.error); return; }
                toast.success("Reservation declined");
                onOpenChange(false);
                onDone();
              } finally { setBusy(false); }
            }}
          >
            {busy ? "Declining…" : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({
  reservation, tables, open, onOpenChange, onDone,
}: {
  reservation: RowReservation;
  tables: { id: string; name: string; capacity: number }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(reservation.dateOnly);
  const [time, setTime] = useState(reservation.time);
  const [partySize, setPartySize] = useState(String(reservation.partySize));
  const [tableId, setTableId] = useState(reservation.tableId ?? "auto");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await rescheduleReservationAction({
        id: reservation.id, date, time,
        partySize: Number(partySize),
        tableId: tableId === "auto" ? "" : tableId,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Reservation rescheduled");
      onOpenChange(false);
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reschedule reservation</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" min={localDateKey()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Party size</Label><Input type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} /></div>
          {tables.length > 0 && (
            <div className="space-y-1.5">
              <Label>Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-assign</SelectItem>
                  {tables.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.capacity})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Reschedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
