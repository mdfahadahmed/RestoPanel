// Storage-provider-agnostic upload contract.
//
// Any provider (local disk, Cloudinary, S3, UploadThing, …) implements
// `UploadService`. The rest of the app — the Product module included — only ever
// depends on this interface and the `/api/upload` endpoint, never on a concrete
// provider. Switching providers is therefore a config change, not a code change.

export interface UploadInput {
  /** Raw file bytes. */
  data: Buffer;
  /** Original filename (used to derive an extension). */
  filename: string;
  /** MIME type, e.g. "image/png". */
  contentType: string;
  /**
   * Logical folder/namespace for the asset, e.g.
   * `restaurants/<restaurantId>/products`. Providers map this to their own
   * notion of a path/folder. Always namespace by restaurantId for tenant
   * isolation.
   */
  folder: string;
}

export interface UploadedFile {
  /** Public URL to render in an <img>. */
  url: string;
  /**
   * Provider-specific identifier used for deletion (a relative path for local,
   * a public_id for Cloudinary, an object key for S3, …).
   */
  key: string;
  /** Which provider produced this asset (audit/debug). */
  provider: string;
  /** Optional metadata when the provider returns it. */
  width?: number;
  height?: number;
  bytes?: number;
  contentType?: string;
}

/** Reference to an already-stored asset (as persisted on a product). */
export interface AssetRef {
  url: string;
  key: string;
}

export interface UploadService {
  /** Human-readable provider name (e.g. "local", "cloudinary"). */
  readonly name: string;
  /** Store a file and return its public URL + deletion key. */
  upload(input: UploadInput): Promise<UploadedFile>;
  /** Remove a previously uploaded file by its key. Idempotent. */
  delete(key: string): Promise<void>;
  /**
   * Duplicate an existing asset into `folder`, producing a brand-new file with
   * its own URL + key. The copy is fully independent: deleting or replacing the
   * source never affects it (and vice-versa). Used when duplicating a product so
   * each product owns its own image records.
   */
  copy(source: AssetRef, folder: string): Promise<UploadedFile>;
}

/** Thrown for user-facing validation problems (bad type, too large, …). */
export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}
