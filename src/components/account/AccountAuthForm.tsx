"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthField } from "@/components/auth/AuthField";
import { loginCustomer, registerCustomer } from "@/app/account/actions";
import {
  customerLoginSchema,
  customerRegisterSchema,
} from "@/lib/validations/account";

export function AccountAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());

    // Client-side validation for instant feedback.
    const schema = mode === "login" ? customerLoginSchema : customerRegisterSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) if (v?.[0]) mapped[k] = v[0];
      setErrors(mapped);
      return;
    }

    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await loginCustomer(parsed.data)
          : await registerCustomer(parsed.data);

      if (!res.ok) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setErrors(mapped);
        }
        setFormError(res.error);
        return;
      }

      toast.success(mode === "login" ? "Welcome back!" : "Account created");
      router.replace(next);
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass w-full max-w-md rounded-2xl p-7 shadow-soft">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Sign in to your account" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-fog-400">
        {mode === "login"
          ? "Track orders, save favourites and reorder in seconds."
          : "One account for every RestoPanel restaurant you order from."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {mode === "register" && (
          <AuthField
            id="name"
            name="name"
            label="Full name"
            placeholder="Jamie Rivera"
            autoComplete="name"
            error={errors.name}
            required
          />
        )}
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
        {mode === "register" && (
          <AuthField
            id="phone"
            name="phone"
            label="Phone (optional)"
            placeholder="+44 7700 900123"
            autoComplete="tel"
            error={errors.phone}
          />
        )}
        <AuthField
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={errors.password}
          required
        />
        {mode === "login" && (
          <div className="-mt-1 text-right">
            <Link
              href="/account/forgot-password"
              className="text-xs font-medium text-fog-400 hover:text-fog-100"
            >
              Forgot password?
            </Link>
          </div>
        )}
        {mode === "register" && (
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
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fog-400">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              href="/account/register"
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/account/login"
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
