"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AuthField } from "@/components/auth/AuthField";
import { changePassword } from "@/app/account/actions";
import { changePasswordSchema } from "@/lib/validations/account";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const values = {
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) if (v?.[0]) mapped[k] = v[0];
      setErrors(mapped);
      return;
    }

    setSubmitting(true);
    try {
      const res = await changePassword(parsed.data);
      if (!res.ok) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setErrors(mapped);
        }
        toast.error(res.error);
        return;
      }
      toast.success("Password changed");
      formRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-line bg-ink-900/40 p-6"
      noValidate
    >
      <div>
        <h2 className="text-sm font-semibold text-fog-100">Change password</h2>
        <p className="mt-1 text-xs text-fog-500">
          For your security, changing your password signs out your other devices.
        </p>
      </div>

      <AuthField
        id="currentPassword"
        name="currentPassword"
        type="password"
        label="Current password"
        autoComplete="current-password"
        error={errors.currentPassword}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          id="newPassword"
          name="newPassword"
          type="password"
          label="New password"
          autoComplete="new-password"
          error={errors.newPassword}
          required
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          required
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl border border-line bg-ink-800 px-5 py-2.5 text-sm font-semibold text-fog-100 transition hover:bg-ink-700 disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
