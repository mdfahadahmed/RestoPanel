import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  assertValidImage,
  getUploadService,
  tenantFolder,
  UploadValidationError,
} from "@/lib/upload";

// Asset kinds the dashboard may upload, mapped to tenant-scoped folders.
const ALLOWED_KINDS = new Set(["products", "logos", "covers", "gallery"]);

/** Upload an image. Returns { url, key } — provider-agnostic. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const restaurantId = session.user.restaurantId;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "products");
  const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : "products";

  try {
    assertValidImage(file.type, file.size);
    const data = Buffer.from(await file.arrayBuffer());
    const result = await getUploadService().upload({
      data,
      filename: file.name || "upload",
      contentType: file.type,
      folder: tenantFolder(restaurantId, kind),
    });
    return NextResponse.json({ url: result.url, key: result.key, provider: result.provider });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

/** Delete an image by key — only within the caller's own tenant namespace. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const restaurantId = session.user.restaurantId;

  const body = await request.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key : "";

  // Tenant isolation: a key must live inside this restaurant's namespace.
  if (!key || !key.includes(`restaurants/${restaurantId}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await getUploadService().delete(key);
  return NextResponse.json({ ok: true });
}
