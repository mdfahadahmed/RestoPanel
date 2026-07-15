"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSupportTicket } from "./actions";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export function NewTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const payload = {
      subject: String(form.get("subject") ?? ""),
      priority: String(form.get("priority") ?? "NORMAL"),
      body: String(form.get("body") ?? ""),
    };
    setPending(true);
    try {
      const res = await createSupportTicket(payload);
      if (!res.ok) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setErrors(mapped);
        }
        toast.error(res.error);
        return;
      }
      toast.success("Ticket created — we'll be in touch.");
      setOpen(false);
      router.push(`/dashboard/support/${res.data!.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn-glow inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-fog-100">
          <Plus className="h-4 w-4" /> New ticket
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact support</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="subject" className="text-sm font-medium text-fog-300">Subject</label>
            <input
              id="subject"
              name="subject"
              placeholder="e.g. Payments not settling"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
            />
            {errors.subject && <p className="text-xs text-rose-400">{errors.subject}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="priority" className="text-sm font-medium text-fog-300">Priority</label>
            <select
              id="priority"
              name="priority"
              defaultValue="NORMAL"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="body" className="text-sm font-medium text-fog-300">How can we help?</label>
            <textarea
              id="body"
              name="body"
              rows={5}
              placeholder="Describe the issue, with any steps to reproduce…"
              className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
            />
            {errors.body && <p className="text-xs text-rose-400">{errors.body}</p>}
          </div>
          <DialogFooter>
            <button
              type="submit"
              disabled={pending}
              className="btn-glow w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send ticket"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
