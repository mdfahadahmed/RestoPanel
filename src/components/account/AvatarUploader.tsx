"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, User, X } from "lucide-react";

export interface AvatarValue {
  url: string;
  key: string;
}

/** Avatar picker for a customer account. Posts to /api/account/upload. */
export function AvatarUploader({
  value,
  onChange,
}: {
  value: AvatarValue | null;
  onChange: (v: AvatarValue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      onChange({ url: data.url, key: data.key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    const current = value;
    onChange(null);
    if (current?.key) {
      void fetch("/api/account/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: current.key }),
      });
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-line bg-ink-850">
        {value?.url ? (
          <Image src={value.url} alt="Avatar" fill sizes="80px" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-fog-500">
            <User className="h-8 w-8" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <Loader2 className="h-5 w-5 animate-spin text-fog-100" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-fog-200 transition hover:bg-ink-700 disabled:opacity-60"
        >
          {value?.url ? "Change photo" : "Upload photo"}
        </button>
        {value?.url && (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center gap-1 text-xs text-fog-500 transition hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
        <p className="text-[11px] text-fog-600">PNG, JPG, WEBP up to 5MB</p>
      </div>
    </div>
  );
}
