/**
 * RFC 6238 TOTP (and RFC 4226 HOTP) implemented with the Web Crypto API
 * (HMAC-SHA1) — no native modules, no external library, matching the codebase's
 * dependency-free crypto approach. Used for app-authenticator two-factor auth.
 */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 (no padding). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** A new random base32 TOTP secret (default 20 bytes = 160 bits). */
export function generateTotpSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  return buf;
}

/** RFC 4226 HOTP for a counter, returning a zero-padded `digits`-length code. */
export async function hotp(secretBytes: Uint8Array, counter: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secretBytes as unknown as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter) as unknown as BufferSource));
  const offset = mac[mac.length - 1] & 0xf;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export interface TotpOptions {
  step?: number; // seconds per window (default 30)
  digits?: number; // default 6
  time?: number; // ms (default now)
}

/** Current TOTP code for a base32 secret. */
export async function totp(secret: string, opts: TotpOptions = {}): Promise<string> {
  const step = opts.step ?? 30;
  const time = opts.time ?? Date.now();
  const counter = Math.floor(time / 1000 / step);
  return hotp(base32Decode(secret), counter, opts.digits ?? 6);
}

/**
 * Verify a submitted TOTP token against a secret, tolerating ±`window` steps for
 * clock drift. Constant-ish: checks each candidate without early-typing leaks.
 */
export async function verifyTotp(
  secret: string,
  token: string,
  opts: TotpOptions & { window?: number } = {}
): Promise<boolean> {
  const clean = (token || "").replace(/\s+/g, "");
  const digits = opts.digits ?? 6;
  if (!new RegExp(`^\\d{${digits}}$`).test(clean)) return false;

  const step = opts.step ?? 30;
  const time = opts.time ?? Date.now();
  const window = opts.window ?? 1;
  const secretBytes = base32Decode(secret);
  const base = Math.floor(time / 1000 / step);

  let ok = false;
  for (let i = -window; i <= window; i++) {
    const candidate = await hotp(secretBytes, base + i, digits);
    if (candidate.length === clean.length) {
      let diff = 0;
      for (let j = 0; j < candidate.length; j++) diff |= candidate.charCodeAt(j) ^ clean.charCodeAt(j);
      if (diff === 0) ok = true;
    }
  }
  return ok;
}

/** otpauth:// URI for QR provisioning in authenticator apps. */
export function otpauthUrl(secret: string, accountName: string, issuer = "RestoPanel"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
