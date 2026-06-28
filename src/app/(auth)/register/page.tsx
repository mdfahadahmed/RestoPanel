"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { AuthField } from "@/components/auth/AuthField";
import { registerSchema } from "@/lib/validations/auth";

type FieldErrors = Record<string, string[] | undefined>;

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(e.currentTarget);
    const data = {
      restaurantName: String(form.get("restaurantName") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };

    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.issues?.fieldErrors) setErrors(body.issues.fieldErrors);
        setFormError(body?.error ?? "Registration failed. Please try again.");
        return;
      }

      // Auto sign-in into the freshly created workspace.
      const login = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (login?.error) {
        // Account created but auto-login failed — send them to login.
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass w-full max-w-lg rounded-2xl p-7 shadow-soft">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create your restaurant
      </h1>
      <p className="mt-1 text-sm text-fog-400">
        Spin up a dedicated dashboard and customer ordering site in seconds.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <AuthField
          id="restaurantName"
          name="restaurantName"
          label="Restaurant name"
          placeholder="Bella Tavola"
          error={errors.restaurantName?.[0]}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            id="ownerName"
            name="ownerName"
            label="Owner name"
            placeholder="Jane Smith"
            autoComplete="name"
            error={errors.ownerName?.[0]}
            required
          />
          <AuthField
            id="phone"
            name="phone"
            type="tel"
            label="Phone"
            placeholder="+44 7700 900000"
            autoComplete="tel"
            error={errors.phone?.[0]}
            required
          />
        </div>
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="owner@restaurant.com"
          autoComplete="email"
          error={errors.email?.[0]}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            error={errors.password?.[0]}
            required
          />
          <AuthField
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm password"
            placeholder="Re-enter password"
            autoComplete="new-password"
            error={errors.confirmPassword?.[0]}
            required
          />
        </div>

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
          {submitting ? "Creating workspace…" : "Create my dashboard"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fog-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
