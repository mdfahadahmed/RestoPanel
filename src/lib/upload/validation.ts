import { UploadValidationError } from "./types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/** Throws UploadValidationError if the file isn't an allowed image or is too large. */
export function assertValidImage(contentType: string, bytes: number): void {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new UploadValidationError(
      "Unsupported file type. Use JPG, PNG, WEBP, GIF or AVIF."
    );
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("File is too large. Maximum size is 5 MB.");
  }
}

/** Resolve a file extension from the MIME type, falling back to the filename. */
export function extensionForType(contentType: string, filename: string): string {
  if (EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType];
  const fromName = filename.includes(".")
    ? `.${filename.split(".").pop()!.toLowerCase()}`
    : "";
  return fromName || ".bin";
}
