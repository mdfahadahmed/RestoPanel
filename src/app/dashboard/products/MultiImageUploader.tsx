"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { uploadImage, deleteImage } from "@/lib/upload/client";
import type { ProductImage } from "@/lib/validations/product";
import { cn } from "@/lib/utils";

interface MultiImageUploaderProps {
  value: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  max?: number;
}

/**
 * Gallery uploader: drag-and-drop or click to add multiple images, reorder by
 * dragging tiles, remove individually. The first image is the thumbnail.
 * Talks only to the provider-agnostic upload client.
 */
export function MultiImageUploader({
  value,
  onChange,
  max = 10,
}: MultiImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const room = max - value.length;
    if (room <= 0) {
      toast.error(`You can add up to ${max} images`);
      return;
    }
    setBusy(true);
    const added: ProductImage[] = [];
    try {
      for (const file of list.slice(0, room)) {
        try {
          const res = await uploadImage(file, "products");
          added.push({ url: res.url, key: res.key });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      }
      if (added.length) onChange([...value, ...added]);
    } finally {
      setBusy(false);
    }
  }

  function removeAt(index: number) {
    const img = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (img?.key) void deleteImage(img.key);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <div
            key={img.key}
            draggable
            onDragStart={() => (dragIndex.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current !== null) reorder(dragIndex.current, i);
              dragIndex.current = null;
            }}
            className="group relative aspect-square cursor-grab overflow-hidden rounded-xl border border-line bg-ink-850 active:cursor-grabbing"
          >
            <Image
              src={img.url}
              alt={`Image ${i + 1}`}
              fill
              sizes="200px"
              className="object-cover"
            />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-gold-300">
                <Star className="h-3 w-3" /> Thumbnail
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-fog-100 opacity-0 transition group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {value.length < max && (
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
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition",
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
            <span>{busy ? "Uploading…" : "Add"}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-fog-500">
        Drag to reorder · the first image is the thumbnail · up to {max} images.
      </p>
    </div>
  );
}
