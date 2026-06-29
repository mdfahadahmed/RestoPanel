"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import type { NotificationChannel, NotificationEvent } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_META, NOTIFICATION_EVENTS } from "@/lib/notifications/templates";
import { sendTestAction } from "./actions";

export function SendTestForm({ emailReady, smsReady }: { emailReady: boolean; smsReady: boolean }) {
  const router = useRouter();
  const [event, setEvent] = useState<NotificationEvent>("ORDER_CONFIRMED");
  const [channel, setChannel] = useState<NotificationChannel>("EMAIL");
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState(false);

  const availableChannels = EVENT_META[event].channels;
  const effectiveChannel = availableChannels.includes(channel) ? channel : availableChannels[0];

  async function send() {
    setPending(true);
    try {
      const res = await sendTestAction({ event, channel: effectiveChannel, recipient });
      if (!res.ok) { toast.error(res.error); return; }
      const status = res.data?.status;
      if (status === "SENT") toast.success("Test notification sent");
      else if (status === "SKIPPED") toast.message("Logged as skipped — provider not configured");
      else toast.error("Test failed to send");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-fog-400" /> Send a test</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Event</Label>
          <Select value={event} onValueChange={(v) => setEvent(v as NotificationEvent)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTIFICATION_EVENTS.map((e) => (
                <SelectItem key={e} value={e}>{EVENT_META[e].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={effectiveChannel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableChannels.map((c) => (
                <SelectItem key={c} value={c}>{c === "EMAIL" ? "Email" : "SMS"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="test-recipient">Recipient {effectiveChannel === "EMAIL" ? "email" : "phone"}</Label>
          <Input
            id="test-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={effectiveChannel === "EMAIL" ? "you@example.com" : "+44…"}
          />
          {((effectiveChannel === "EMAIL" && !emailReady) || (effectiveChannel === "SMS" && !smsReady)) && (
            <p className="text-xs text-amber-300/80">
              {effectiveChannel === "EMAIL" ? "Email" : "SMS"} provider isn&apos;t configured — the test will be logged as skipped.
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button variant="primary" onClick={send} disabled={pending || !recipient.trim()}>
            {pending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
