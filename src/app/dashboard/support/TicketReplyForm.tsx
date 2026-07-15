"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { replySupportTicket } from "./actions";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = String(new FormData(e.currentTarget).get("body") ?? "").trim();
    if (!body) return;
    setPending(true);
    try {
      const res = await replySupportTicket({ ticketId, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-2">
      <textarea
        name="body"
        rows={3}
        placeholder="Write a reply…"
        className="w-full rounded-xl border border-line bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 outline-none focus:border-violet-500/60"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
