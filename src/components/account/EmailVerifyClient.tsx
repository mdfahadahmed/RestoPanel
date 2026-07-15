"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

type State = "verifying" | "success" | "error";

/**
 * Shared email-verification result screen. The `verify` server action is passed
 * in so the same UI serves both the customer (/account) and owner (/dashboard)
 * flows — the token itself carries the scope, so one action handles both.
 */
export function EmailVerifyClient({
  verify,
  homeHref,
  homeLabel,
}: {
  verify: (token: string) => Promise<ActionResult>;
  homeHref: string;
  homeLabel: string;
}) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(
    token ? null : "This verification link is missing its token."
  );
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // guard React 18 double-invoke
    verify(token).then((res) => {
      if (res.ok) {
        setState("success");
      } else {
        setState("error");
        setMessage(res.error);
      }
    });
  }, [token]);

  return (
    <div className="glass w-full max-w-md rounded-2xl p-7 text-center shadow-soft">
      {state === "verifying" && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-400" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Verifying your email…</h1>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Email verified</h1>
          <p className="mt-1 text-sm text-fog-400">
            Thanks — your account is now secured.
          </p>
          <Link
            href={homeHref}
            className="btn-glow mt-6 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
          >
            {homeLabel}
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Verification failed</h1>
          <p className="mt-1 text-sm text-fog-400">
            {message ?? "This link is invalid or has expired."}
          </p>
          <Link
            href={homeHref}
            className="mt-6 inline-block text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            {homeLabel}
          </Link>
        </>
      )}
    </div>
  );
}
