// Client helper used by dashboard components to upload/delete images via the
// provider-agnostic /api/upload endpoint. Components depend on this, never on a
// storage provider directly.

export interface UploadResult {
  url: string;
  key: string;
  provider: string;
}

export async function uploadImage(
  file: File,
  kind: "products" | "logos" | "covers" | "gallery" = "products"
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? "Upload failed");
  }
  return json as UploadResult;
}

export async function deleteImage(key: string): Promise<void> {
  await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}
