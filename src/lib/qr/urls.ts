import type { QrCode } from "@prisma/client";

/**
 * Pure URL/slug helpers for the QR menu system. No DB or framework imports so
 * they can be unit-tested directly.
 */

/** Strip a trailing slash so we can safely concatenate paths. */
export function normaliseBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

/** Resolve the absolute app base URL (used to build the data a QR encodes). */
export function getBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  return normaliseBaseUrl(fromEnv);
}

/** A short, URL-safe, unambiguous code for /q/<code> redirects. */
export function generateQrSlug(length = 8): string {
  // Avoid look-alike characters (0/O, 1/l/I).
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

type TargetInput = Pick<QrCode, "type" | "tableNumber" | "targetPath">;

/**
 * The storefront path a code ultimately lands on (relative, starts with `/`).
 *  - MENU    → /r/<slug>
 *  - TABLE   → /r/<slug>?table=<n>
 *  - DYNAMIC → its editable targetPath (defaulting to /r/<slug>)
 */
export function resolveTargetPath(qr: TargetInput, slug: string): string {
  const home = `/r/${slug}`;
  switch (qr.type) {
    case "TABLE":
      return qr.tableNumber != null ? `${home}?table=${qr.tableNumber}` : home;
    case "DYNAMIC": {
      const path = (qr.targetPath ?? "").trim();
      if (!path) return home;
      return path.startsWith("/") ? path : `/${path}`;
    }
    case "MENU":
    default:
      return home;
  }
}

/** Absolute resolved destination (what the browser ends up on). */
export function resolveTargetUrl(qr: TargetInput, slug: string, baseUrl = getBaseUrl()): string {
  return `${normaliseBaseUrl(baseUrl)}${resolveTargetPath(qr, slug)}`;
}

/**
 * The actual string the QR image encodes:
 *  - dynamic → the /q/<code> redirect (re-pointable + tracked)
 *  - static  → the resolved destination directly
 */
export function encodedUrl(
  qr: Pick<QrCode, "type" | "tableNumber" | "targetPath" | "code" | "isDynamic">,
  slug: string,
  baseUrl = getBaseUrl()
): string {
  const base = normaliseBaseUrl(baseUrl);
  if (qr.isDynamic) return `${base}/q/${qr.code}`;
  return resolveTargetUrl(qr, slug, base);
}
