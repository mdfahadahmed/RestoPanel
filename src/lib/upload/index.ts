import type { AssetRef, UploadService } from "./types";
import { LocalUploadService } from "./local";
import { CloudinaryUploadService } from "./cloudinary";

export * from "./types";
export {
  MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_TYPES,
  assertValidImage,
} from "./validation";

export type UploadProvider = "local" | "cloudinary";

// Registry of available providers. Add new ones here (e.g. "s3") — nothing else
// in the app needs to change.
const providers: Record<UploadProvider, () => UploadService> = {
  local: () => new LocalUploadService(),
  cloudinary: () => new CloudinaryUploadService(),
};

let cached: UploadService | undefined;

/**
 * Returns the configured UploadService (singleton). Selected by the
 * UPLOAD_PROVIDER env var; defaults to "local". This is the ONLY place that
 * knows which concrete provider is in use.
 */
export function getUploadService(): UploadService {
  if (cached) return cached;

  const provider = (process.env.UPLOAD_PROVIDER ?? "local") as UploadProvider;
  const factory = providers[provider];
  if (!factory) {
    throw new Error(
      `Unknown UPLOAD_PROVIDER "${provider}". Valid values: ${Object.keys(providers).join(", ")}.`
    );
  }
  cached = factory();
  return cached;
}

/** Build the tenant-scoped folder/namespace for an asset. */
export function tenantFolder(restaurantId: string, kind: string): string {
  return `restaurants/${restaurantId}/${kind}`;
}

/**
 * Copy a set of asset references into a tenant's namespace, returning fresh,
 * independent references (new url + key per asset). Used when duplicating a
 * product so the copy never shares image files with the original. A failed
 * individual copy is skipped — we never fall back to referencing the source,
 * which would defeat the independence guarantee.
 */
export async function copyAssets(
  restaurantId: string,
  kind: string,
  sources: AssetRef[]
): Promise<AssetRef[]> {
  if (sources.length === 0) return [];
  const service = getUploadService();
  const folder = tenantFolder(restaurantId, kind);

  const copied: AssetRef[] = [];
  for (const src of sources) {
    if (!src?.url || !src?.key) continue;
    try {
      const file = await service.copy(src, folder);
      copied.push({ url: file.url, key: file.key });
    } catch (err) {
      console.error(`copyAssets: failed to copy ${src.key}`, err);
    }
  }
  return copied;
}
