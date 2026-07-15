import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Email-verification tokens, shared across auth surfaces. `scope` selects the
 * subject table ("customer" → CustomerAccount, "user" → owner/staff User) and
 * `subjectId` is that row's id. Only the SHA-256 hash of the raw token is
 * stored, so a DB leak can't be used to verify accounts. Tokens are single-use
 * and expire after 24 hours; issuing a new one invalidates prior unused tokens.
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type VerifyScope = "customer" | "user";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Mint a verification token for a subject and return the raw token (to email). */
export async function createEmailVerificationToken(
  scope: VerifyScope,
  subjectId: string,
  email: string
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { scope, subjectId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: {
        scope,
        subjectId,
        email,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);
  return rawToken;
}

export interface ConsumeResult {
  ok: boolean;
  scope?: VerifyScope;
  subjectId?: string;
}

/**
 * Consume a token and stamp the subject's `emailVerifiedAt`. Idempotent-ish: a
 * used/expired/unknown token returns `{ ok: false }` without side effects.
 */
export async function consumeEmailVerificationToken(
  rawToken: string
): Promise<ConsumeResult> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, scope: true, subjectId: true, usedAt: true, expiresAt: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false };
  }

  const scope = record.scope as VerifyScope;
  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    if (scope === "customer") {
      await tx.customerAccount.update({
        where: { id: record.subjectId },
        data: { emailVerifiedAt: new Date() },
      });
    } else {
      await tx.user.update({
        where: { id: record.subjectId },
        data: { emailVerifiedAt: new Date() },
      });
    }
  });
  return { ok: true, scope, subjectId: record.subjectId };
}
