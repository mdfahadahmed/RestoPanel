import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/account/context";
import {
  assertValidImage,
  getUploadService,
  UploadValidationError,
} from "@/lib/upload";

// Avatar folder for a customer account (namespaced by accountId for isolation).
function accountFolder(accountId: string): string {
  return `customers/${accountId}/avatar`;
}

/** Upload a customer avatar. Returns { url, key }. */
export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    assertValidImage(file.type, file.size);
    const data = Buffer.from(await file.arrayBuffer());
    const result = await getUploadService().upload({
      data,
      filename: file.name || "avatar",
      contentType: file.type,
      folder: accountFolder(session.accountId),
    });
    return NextResponse.json({ url: result.url, key: result.key, provider: result.provider });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[account upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

/** Delete an avatar by key — only within the caller's own account namespace. */
export async function DELETE(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key : "";

  if (!key || !key.includes(`customers/${session.accountId}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await getUploadService().delete(key);
  return NextResponse.json({ ok: true });
}
