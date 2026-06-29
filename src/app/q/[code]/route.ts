import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/qr/data";
import { normaliseBaseUrl } from "@/lib/qr/urls";

// Public, dynamic QR redirect. Scanning a code hits /q/<code>, we record the
// scan and 302 to the current storefront destination. Because the target lives
// in the DB, a "dynamic" code can be re-pointed without reprinting it.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const origin = normaliseBaseUrl(new URL(request.url).origin);

  const resolution = await resolveScan(code);
  if (!resolution) {
    // Unknown or disabled code → send to the marketing home rather than erroring.
    return NextResponse.redirect(`${origin}/`, { status: 302 });
  }

  return NextResponse.redirect(`${origin}${resolution.targetPath}`, { status: 302 });
}
