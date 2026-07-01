"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthField } from "@/components/auth/AuthField";
import { AvatarUploader, type AvatarValue } from "./AvatarUploader";
import { updateProfile } from "@/app/account/actions";
import { updateProfileSchema } from "@/lib/validations/account";

interface ProfileFormProps {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  avatarKey: string | null;
}

export function ProfileForm(props: ProfileFormProps) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarValue | null>(
    props.avatarUrl ? { url: props.avatarUrl, key: props.avatarKey ?? "" } : null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const values = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      avatarUrl: avatar?.url ?? "",
      avatarKey: avatar?.key ?? "",
    };
    const parsed = updateProfileSchema.safeParse(values);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) if (v?.[0]) mapped[k] = v[0];
      setErrors(mapped);
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateProfile(parsed.data);
      if (!res.ok) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setErrors(mapped);
        }
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-line bg-ink-900/40 p-6"
      noValidate
    >
      <h2 className="text-sm font-semibold text-fog-100">Personal details</h2>

      <AvatarUploader value={avatar} onChange={setAvatar} />

      <AuthField
        id="name"
        name="name"
        label="Full name"
        defaultValue={props.name}
        error={errors.name}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email"
          defaultValue={props.email}
          error={errors.email}
          required
        />
        <AuthField
          id="phone"
          name="phone"
          label="Phone"
          defaultValue={props.phone}
          error={errors.phone}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="btn-glow rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
