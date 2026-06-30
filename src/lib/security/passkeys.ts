import { prisma } from "@/lib/prisma";

/**
 * Passkey (WebAuthn credential) storage & management. Verification lives in
 * `webauthn.ts`; this module persists credentials and exposes them for the
 * authentication ceremony + the user's "manage passkeys" screen.
 */

export interface RegisterPasskeyInput {
  userId: string;
  restaurantId: string;
  credentialId: string; // base64url
  publicKey: string; // base64url
  counter?: number;
  transports?: string[];
  label?: string | null;
}

export async function registerPasskey(input: RegisterPasskeyInput) {
  return prisma.passkey.create({
    data: {
      userId: input.userId,
      restaurantId: input.restaurantId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter ?? 0,
      transports: input.transports ?? [],
      label: input.label ?? null,
    },
    select: { id: true },
  });
}

export async function listPasskeys(restaurantId: string, userId: string) {
  return prisma.passkey.findMany({
    where: { restaurantId, userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, transports: true, createdAt: true, lastUsedAt: true, credentialId: true },
  });
}

/** Resolve a credential by its id (for the authentication ceremony). */
export async function getPasskeyByCredentialId(credentialId: string) {
  return prisma.passkey.findUnique({ where: { credentialId } });
}

/** Persist the new signature counter + last-used stamp after a successful auth. */
export async function updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
  await prisma.passkey
    .update({ where: { credentialId }, data: { counter, lastUsedAt: new Date() } })
    .catch(() => undefined);
}

export type PasskeyResult = { ok: true } | { ok: false; error: string };

export async function deletePasskey(restaurantId: string, userId: string, id: string): Promise<PasskeyResult> {
  const res = await prisma.passkey.deleteMany({ where: { id, restaurantId, userId } });
  return res.count > 0 ? { ok: true } : { ok: false, error: "Passkey not found" };
}

export async function renamePasskey(
  restaurantId: string,
  userId: string,
  id: string,
  label: string
): Promise<PasskeyResult> {
  const res = await prisma.passkey.updateMany({
    where: { id, restaurantId, userId },
    data: { label: label.trim() || null },
  });
  return res.count > 0 ? { ok: true } : { ok: false, error: "Passkey not found" };
}
