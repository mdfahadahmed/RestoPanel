import type { Role } from "@prisma/client";

/**
 * Stateless, signed access tokens for the mobile app — separate from the web
 * Auth.js session and the Super Admin session. Implemented with Web Crypto
 * (HMAC-SHA256) so it runs in edge and Node with no native deps, mirroring
 * `lib/admin/session.ts`. Token form: `base64url(payload).base64url(sig)`.
 *
 * Access tokens are short-lived; long-lived refresh tokens are opaque and stored
 * (hashed) on the MobileDevice row so they can be rotated and revoked.
 */

export interface MobileTokenPayload {
  sub: string; // User id
  rid: string; // restaurantId
  did: string; // MobileDevice id (the session/device)
  role: Role;
  exp: number; // unix seconds
}

export const ACCESS_TOKEN_TTL = 60 * 15; // 15 minutes
export const REFRESH_TOKEN_TTL_DAYS = 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  // Namespace the key material so mobile tokens can never be confused with
  // admin tokens even though both use AUTH_SECRET.
  return `mobile:${value}`;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Sign a mobile access token. `ttlSeconds` defaults to {@link ACCESS_TOKEN_TTL}. */
export async function signMobileToken(
  payload: Omit<MobileTokenPayload, "exp">,
  ttlSeconds: number = ACCESS_TOKEN_TTL
): Promise<string> {
  const body: MobileTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = bytesToB64url(encoder.encode(JSON.stringify(body)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
  return `${data}.${bytesToB64url(sig)}`;
}

/** Verify a mobile access token. Returns the payload, or null if invalid/expired. */
export async function verifyMobileToken(token: string | undefined | null): Promise<MobileTokenPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!data || !sig) return null;

  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig) as unknown as BufferSource,
      encoder.encode(data)
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(b64urlToBytes(data))) as MobileTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
