"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, MessageSquare, Pencil, RotateCcw } from "lucide-react";
import type { NotificationChannel, NotificationEvent } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENT_META, NOTIFICATION_EVENTS } from "@/lib/notifications/templates";
import {
  saveTemplateAction,
  toggleTemplateAction,
  resetTemplateAction,
} from "./actions";

export interface TemplateRow {
  event: NotificationEvent;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  isActive: boolean;
  isCustom: boolean;
}

export function TemplateEditor({ templates }: { templates: TemplateRow[] }) {
  const byKey = new Map(templates.map((t) => [`${t.event}:${t.channel}`, t]));

  return (
    <div className="space-y-4">
      {NOTIFICATION_EVENTS.map((event) => {
        const meta = EVENT_META[event];
        return (
          <Card key={event}>
            <CardHeader className="pb-3">
              <CardTitle>{meta.label}</CardTitle>
              <p className="text-sm text-fog-500">{meta.description}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {meta.channels.map((channel) => {
                const row = byKey.get(`${event}:${channel}`);
                if (!row) return null;
                return <ChannelRow key={channel} row={row} placeholders={meta.placeholders} />;
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ChannelRow({ row, placeholders }: { row: TemplateRow; placeholders: string[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const res = await toggleTemplateAction({ event: row.event, channel: row.channel, isActive: next });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(next ? "Channel enabled" : "Channel disabled");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const res = await resetTemplateAction({ event: row.event, channel: row.channel });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Reverted to default");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {row.channel === "EMAIL" ? (
          <Badge variant="violet"><Mail className="h-3 w-3" /> Email</Badge>
        ) : (
          <Badge variant="sky"><MessageSquare className="h-3 w-3" /> SMS</Badge>
        )}
        {row.isCustom ? <Badge variant="gold">custom</Badge> : <Badge variant="outline">default</Badge>}
        <span className="max-w-[280px] truncate text-xs text-fog-500">{row.body}</span>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={row.isActive} onCheckedChange={toggle} disabled={busy} aria-label="Enabled" />
        <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        {row.isCustom && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      <EditDialog row={row} placeholders={placeholders} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function EditDialog({
  row,
  placeholders,
  open,
  onOpenChange,
}: {
  row: TemplateRow;
  placeholders: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(row.subject ?? "");
  const [body, setBody] = useState(row.body);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await saveTemplateAction({
        event: row.event,
        channel: row.channel,
        subject: row.channel === "EMAIL" ? subject : undefined,
        body,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Template saved");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {EVENT_META[row.event].label} · {row.channel === "EMAIL" ? "Email" : "SMS"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {row.channel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Message</Label>
            <Textarea id="tpl-body" className="min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-fog-500">Insert:</span>
            {placeholders.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBody((b) => `${b}{{${p}}}`)}
                className="rounded-md border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[11px] text-fog-300 hover:text-fog-100"
              >
                {`{{${p}}}`}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={pending || !body.trim()}>
            {pending ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
