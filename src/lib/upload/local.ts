import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import type { AssetRef, UploadInput, UploadService, UploadedFile } from "./types";
import { extensionForType } from "./validation";

/**
 * Stores uploads on the local filesystem under `public/uploads/<folder>` and
 * serves them via Next's static `/public` handler.
 *
 * Good for development and single-server deployments. NOT suitable for
 * serverless/multi-instance hosting (no shared, persistent disk) — switch
 * `UPLOAD_PROVIDER` to a cloud provider there.
 */
export class LocalUploadService implements UploadService {
  readonly name = "local";

  private readonly publicDir = path.join(process.cwd(), "public");
  private readonly baseDir = "uploads";

  async upload(input: UploadInput): Promise<UploadedFile> {
    const ext = extensionForType(input.contentType, input.filename);
    const safeFolder = input.folder.replace(/[^a-zA-Z0-9/_-]/g, "");
    const fileName = `${randomUUID()}${ext}`;
    const relKey = path.posix.join(this.baseDir, safeFolder, fileName);
    const absPath = path.join(this.publicDir, relKey);

    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, input.data);

    return {
      url: `/${relKey}`,
      key: relKey,
      provider: this.name,
      bytes: input.data.byteLength,
      contentType: input.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    // Guard against path traversal — only allow deleting within /public/uploads.
    const normalized = path.posix.normalize(key);
    if (!normalized.startsWith(`${this.baseDir}/`) || normalized.includes("..")) {
      return;
    }
    const absPath = path.join(this.publicDir, normalized);
    try {
      await unlink(absPath);
    } catch {
      // Already gone — deletion is idempotent.
    }
  }

  async copy(source: AssetRef, folder: string): Promise<UploadedFile> {
    // Guard against path traversal — only read within /public/uploads.
    const normalized = path.posix.normalize(source.key);
    if (!normalized.startsWith(`${this.baseDir}/`) || normalized.includes("..")) {
      throw new Error("Invalid source key");
    }
    const data = await readFile(path.join(this.publicDir, normalized));

    const ext = path.posix.extname(normalized) || ".bin";
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
    const fileName = `${randomUUID()}${ext}`;
    const relKey = path.posix.join(this.baseDir, safeFolder, fileName);
    const absPath = path.join(this.publicDir, relKey);

    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, data);

    return {
      url: `/${relKey}`,
      key: relKey,
      provider: this.name,
      bytes: data.byteLength,
    };
  }
}
