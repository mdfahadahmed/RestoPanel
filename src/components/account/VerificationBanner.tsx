"use client";

import { useState, useTransition } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/app/account/actions";

/**
 * Non-blocking prompt shown across the account panel until the customer verifies
 * their email. "Resend" is rate-limited server-side.
 */
export function VerificationBanner() {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const res = await resendVerificationEmail();
      if (res.ok) {
        setSent(true);
        toast.success("Verification email sent — check your inbox.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200 sm:px-6">
      <span className="inline-flex items-center gap-2">
        <MailWarning className="h-4 w-4 shrink-0" />
        Please verify your email address to secure your account.
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={pending || sent}
        className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-60"
      >
        {sent ? "Email sent" : pending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
