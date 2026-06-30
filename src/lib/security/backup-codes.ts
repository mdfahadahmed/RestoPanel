import { hashApiKey } from "@/lib/api/keys";

/**
 * Single-use 2FA recovery codes. Only SHA-256 hashes are stored (reusing the
 * API-key hasher); the plaintext set is shown to the user exactly once.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused chars

function randomCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`; // e.g. AB3CD-EF7GH
}

/** Generate `count` plaintext recovery codes. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, randomCode);
}

/** Hash a normalised code (case/format-insensitive). */
export function hashBackupCode(code: string): Promise<string> {
  const normalised = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return hashApiKey(normalised);
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(hashBackupCode));
}

/**
 * Check a submitted code against the stored hashes. On success returns the
 * remaining hashes (the used code consumed) so the caller can persist them.
 */
export async function consumeBackupCode(
  storedHashes: string[],
  code: string
): Promise<{ ok: boolean; remaining: string[] }> {
  const hash = await hashBackupCode(code);
  if (!storedHashes.includes(hash)) return { ok: false, remaining: storedHashes };
  return { ok: true, remaining: storedHashes.filter((h) => h !== hash) };
}
