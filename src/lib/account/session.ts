/**
 * Stateless, signed session tokens for the customer account panel (/account) —
 * completely separate from the tenant Auth.js session AND the Super Admin
 * session. A customer is neither a restaurant staff `User` nor a platform
 * `AdminUser`.
 *
 * Implemented with the Web Crypto API (HMAC-SHA256) so the identical code runs
 * in edge middleware and in Node route handlers / server actions. No native
 * modules, no extra dependencies. Token format: `base64url(payload).base64url(sig)`.
 */

export interface CustomerTokenPayload {
  sub: string; // CustomerAccount id
  email: string;
  /** Token version — must match the account's `tokenVersion` to stay valid. */
  ver: number;
  /** Unix seconds expiry. */
  exp: number;
}

export const CUSTOMER_COOKIE = "customer_session";
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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
  return value;
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

/** Sign a customer session token. `maxAgeSeconds` defaults to 30 days. */
export async function signCustomerToken(
  payload: Omit<CustomerTokenPayload, "exp">,
  maxAgeSeconds: number = CUSTOMER_SESSION_MAX_AGE
): Promise<string> {
  const body: CustomerTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const data = bytesToB64url(encoder.encode(JSON.stringify(body)));
  const key = await hmacKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  );
  return `${data}.${bytesToB64url(sig)}`;
}

/**
 * Verify a token's signature + expiry. Returns the payload when valid, else
 * `null`. `crypto.subtle.verify` is constant-time. NOTE: this does NOT check the
 * token version against the database (edge-safe, no Prisma) — the Node-side
 * `requireCustomer()` performs that check.
 */
export async function verifyCustomerToken(
  token: string | undefined | null
): Promise<CustomerTokenPayload | null> {
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

    const payload = JSON.parse(
      decoder.decode(b64urlToBytes(data))
    ) as CustomerTokenPayload;

    if (
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
