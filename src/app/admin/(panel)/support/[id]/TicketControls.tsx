"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TicketStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { replyToTicketAction, setTicketStatusAction } from "../actions";

const STATUSES: TicketStatus[] = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];

export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(next: string) {
    setPending(true);
    try {
      const res = await setTicketStatusAction({ ticketId, status: next as TicketStatus });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Status updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Select defaultValue={status} onValueChange={change} disabled={pending}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setPending(true);
    try {
      const res = await replyToTicketAction({ ticketId, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      toast.success("Reply sent");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply to the tenant…"
        className="min-h-28"
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={send} disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}
