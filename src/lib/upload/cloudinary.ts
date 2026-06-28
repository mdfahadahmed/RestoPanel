import { createHash } from "node:crypto";
import type { AssetRef, UploadInput, UploadService, UploadedFile } from "./types";

/**
 * Cloudinary provider implemented against the REST API with signed requests —
 * no SDK dependency. Activate by setting UPLOAD_PROVIDER=cloudinary and the
 * three CLOUDINARY_* env vars. No Product-module code changes required.
 */
export class CloudinaryUploadService implements UploadService {
  readonly name = "cloudinary";

  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
      );
    }
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  // Cloudinary signature: sha1 of "k=v&k=v..." (sorted) + api_secret.
  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return createHash("sha1").update(toSign + this.apiSecret).digest("hex");
  }

  async upload(input: UploadInput): Promise<UploadedFile> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signed = { folder: input.folder, timestamp };
    const signature = this.sign(signed);

    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.data)], { type: input.contentType });
    form.append("file", blob, input.filename);
    form.append("api_key", this.apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", input.folder);
    form.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: "POST", body: form }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      secure_url: string;
      public_id: string;
      width?: number;
      height?: number;
      bytes?: number;
      resource_type?: string;
    };

    return {
      url: json.secure_url,
      key: json.public_id,
      provider: this.name,
      width: json.width,
      height: json.height,
      bytes: json.bytes,
      contentType: input.contentType,
    };
  }

  async copy(source: AssetRef, folder: string): Promise<UploadedFile> {
    // Cloudinary fetches the source URL and stores it as a brand-new asset in
    // `folder`, yielding a fresh public_id — fully independent of the original.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign({ folder, timestamp });

    const form = new FormData();
    form.append("file", source.url);
    form.append("api_key", this.apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: "POST", body: form }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Cloudinary copy failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      secure_url: string;
      public_id: string;
      width?: number;
      height?: number;
      bytes?: number;
    };

    return {
      url: json.secure_url,
      key: json.public_id,
      provider: this.name,
      width: json.width,
      height: json.height,
      bytes: json.bytes,
    };
  }

  async delete(key: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign({ public_id: key, timestamp });

    const form = new FormData();
    form.append("public_id", key);
    form.append("api_key", this.apiKey);
    form.append("timestamp", timestamp);
    form.append("signature", signature);

    await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`, {
      method: "POST",
      body: form,
    }).catch(() => {
      // Best-effort, idempotent deletion.
    });
  }
}
