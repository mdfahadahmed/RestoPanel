"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthField } from "@/components/auth/AuthField";
import { requestPasswordReset, resetPassword } from "@/app/account/actions";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/account";

/**
 * Two-in-one password reset UI:
 *  - mode="request": ask for an email and trigger a reset link.
 *  - mode="reset":   take the token (from the URL) + a new password.
 */
export function PasswordResetForm({ mode }: { mode: "request" | "reset" }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());

    if (mode === "request") {
      const parsed = forgotPasswordSchema.safeParse(raw);
      if (!parsed.success) {
        setErrors({ email: parsed.error.flatten().fieldErrors.email?.[0] ?? "Enter a valid email" });
        return;
      }
      setSubmitting(true);
      try {
        const res = await requestPasswordReset(parsed.data);
        if (!res.ok) {
          setFormError(res.error);
          return;
        }
        setSent(true);
      } catch {
        setFormError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // mode === "reset"
    const parsed = resetPasswordSchema.safeParse({ ...raw, token });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) if (v?.[0]) mapped[k] = v[0];
      setErrors(mapped);
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword(parsed.data);
      if (!res.ok) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setErrors(mapped);
        }
        setFormError(res.error);
        return;
      }
      toast.success("Password updated — you can sign in now");
      router.replace("/account/login");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "request" && sent) {
    return (
      <div className="glass w-full max-w-md rounded-2xl p-7 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-fog-400">
          If an account exists for that email, we&apos;ve sent a link to reset your
          password. The link expires in one hour.
        </p>
        <Link
          href="/account/login"
          className="mt-6 inline-block text-sm font-medium text-violet-400 hover:text-violet-300"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (mode === "reset" && !token) {
    return (
      <div className="glass w-full max-w-md rounded-2xl p-7 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid reset link</h1>
        <p className="mt-2 text-sm text-fog-400">
          This link is missing its token. Request a fresh reset link to continue.
        </p>
        <Link
          href="/account/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-violet-400 hover:text-violet-300"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="glass w-full max-w-md rounded-2xl p-7 shadow-soft">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "request" ? "Reset your password" : "Choose a new password"}
      </h1>
      <p className="mt-1 text-sm text-fog-400">
        {mode === "request"
          ? "Enter your email and we'll send you a link to reset it."
          : "Pick a strong password you don't use anywhere else."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {mode === "request" ? (
          <AuthField
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email}
            required
          />
        ) : (
          <>
            <AuthField
              id="password"
              name="password"
              type="password"
              label="New password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.password}
              required
            />
            <AuthField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword}
              required
            />
          </>
        )}

        {formError && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-glow w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
        >
          {submitting
            ? mode === "request"
              ? "Sending…"
              : "Updating…"
            : mode === "request"
              ? "Send reset link"
              : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fog-400">
        Remembered it?{" "}
        <Link
          href="/account/login"
          className="font-medium text-violet-400 hover:text-violet-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
