"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadImage, deleteImage, type UploadResult } from "@/lib/upload/client";
import { cn } from "@/lib/utils";

export interface UploadedImage {
  url: string;
  key: string;
}

interface ImageUploaderProps {
  value?: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  kind?: "products" | "logos" | "covers" | "gallery";
  className?: string;
  /** Aspect ratio helper, e.g. "aspect-square" or "aspect-[3/1]". */
  aspect?: string;
  label?: string;
}

/**
 * Single-image picker built on the provider-agnostic upload client. Knows
 * nothing about the underlying storage — only /api/upload.
 */
export function ImageUploader({
  value,
  onChange,
  kind = "products",
  className,
  aspect = "aspect-square",
  label = "Upload image",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const res: UploadResult = await uploadImage(file, kind);
      onChange({ url: res.url, key: res.key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const current = value;
    onChange(null);
    if (current?.key) {
      // Best-effort cleanup; ignore failures.
      void deleteImage(current.key);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
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

      {value?.url ? (
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl border border-line bg-ink-850",
            aspect
          )}
        >
          <Image
            src={value.url}
            alt="Uploaded"
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-fog-100 opacity-0 transition group-hover:opacity-100"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition",
            aspect,
            dragOver
              ? "border-violet-500/60 bg-violet-500/5 text-fog-200"
              : "border-line bg-ink-850 text-fog-400 hover:border-fog-500"
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span>{busy ? "Uploading…" : label}</span>
          <span className="text-xs text-fog-600">PNG, JPG, WEBP up to 5MB</span>
        </button>
      )}
    </div>
  );
}
