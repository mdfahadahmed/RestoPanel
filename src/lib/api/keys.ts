import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidScope } from "./scopes";

/**
 * API key generation, hashing and authentication.
 *
 * Keys look like `rp_live_<32 url-safe chars>`. Only the SHA-256 hash is stored;
 * the plaintext is returned to the owner exactly once. Hashing uses Web Crypto
 * (no native deps); SHA-256 is appropriate for high-entropy secrets and is fast
 * enough to run on every request.
 */

const KEY_PREFIX = "rp_live_";
const RANDOM_LEN = 32;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** SHA-256 → lowercase hex. */
export async function hashApiKey(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface GeneratedKey {
  plaintext: string;
  hashedKey: string;
  prefix: string; // shown in the UI
  last4: string;
}

export async function generateApiKey(): Promise<GeneratedKey> {
  const plaintext = `${KEY_PREFIX}${randomString(RANDOM_LEN)}`;
  return {
    plaintext,
    hashedKey: await hashApiKey(plaintext),
    prefix: plaintext.slice(0, KEY_PREFIX.length + 4), // e.g. rp_live_Ab3X
    last4: plaintext.slice(-4),
  };
}

/** Extract the raw key from `Authorization: Bearer …` or `x-api-key`. */
export function parseApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = headers.get("x-api-key");
  return x ? x.trim() : null;
}

export interface AuthenticatedKey {
  apiKey: ApiKey;
  restaurantId: string;
  scopes: string[];
}

/**
 * Resolve a plaintext key to its (active, non-expired, non-revoked) record and
 * record usage. Returns null on any failure — callers map that to 401.
 */
export async function authenticateApiKey(
  raw: string | null,
  now: Date = new Date()
): Promise<AuthenticatedKey | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;

  const hashedKey = await hashApiKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { hashedKey } });
  if (!key) return null;
  if (!key.isActive || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() < now.getTime()) return null;

  // Best-effort usage stamp; never block the request on it.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: now } })
    .catch(() => undefined);

  return { apiKey: key, restaurantId: key.restaurantId, scopes: key.scopes };
}

// --- Management (tenant-scoped; wrapped by server actions) ------------------

export interface CreateApiKeyInput {
  restaurantId: string;
  name: string;
  scopes: string[];
  rateLimitPerMin?: number;
  expiresAt?: Date | null;
}

export async function createApiKey(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; plaintext: string }> {
  const scopes = input.scopes.filter(isValidScope);
  const generated = await generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      restaurantId: input.restaurantId,
      name: input.name,
      prefix: generated.prefix,
      hashedKey: generated.hashedKey,
      last4: generated.last4,
      scopes,
      rateLimitPerMin: input.rateLimitPerMin ?? 60,
      expiresAt: input.expiresAt ?? null,
    },
  });
  return { apiKey, plaintext: generated.plaintext };
}

export async function listApiKeys(restaurantId: string) {
  return prisma.apiKey.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, prefix: true, last4: true, scopes: true,
      rateLimitPerMin: true, isActive: true, lastUsedAt: true,
      expiresAt: true, revokedAt: true, createdAt: true,
    },
  });
}

export async function revokeApiKey(restaurantId: string, id: string, now: Date = new Date()) {
  const res = await prisma.apiKey.updateMany({
    where: { id, restaurantId },
    data: { isActive: false, revokedAt: now },
  });
  return res.count > 0;
}

export async function deleteApiKey(restaurantId: string, id: string) {
  const res = await prisma.apiKey.deleteMany({ where: { id, restaurantId } });
  return res.count > 0;
}
