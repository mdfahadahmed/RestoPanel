import { prisma } from "@/lib/prisma";
import { generateTotpSecret, verifyTotp, otpauthUrl } from "@/lib/security/totp";
import { generateBackupCodes, hashBackupCodes, consumeBackupCode } from "@/lib/security/backup-codes";

/**
 * Two-factor authentication lifecycle for staff users: enroll (generate secret),
 * confirm (verify first code + issue recovery codes), verify (login step-up),
 * and disable. Secrets/recovery codes live on the User row.
 */

export type EnrollResult = { ok: true; secret: string; otpauthUrl: string } | { ok: false; error: string };

/** Begin enrollment: store a pending secret (not yet active) and return the URI. */
export async function startTwoFactorEnroll(restaurantId: string, userId: string): Promise<EnrollResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { email: true, twoFactorEnabledAt: true },
  });
  if (!user) return { ok: false, error: "User not found" };
  if (user.twoFactorEnabledAt) return { ok: false, error: "Two-factor is already enabled" };

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabledAt: null } });
  return { ok: true, secret, otpauthUrl: otpauthUrl(secret, user.email) };
}

export type ConfirmResult = { ok: true; backupCodes: string[] } | { ok: false; error: string };

/** Confirm enrollment by verifying the first code; returns one-time backup codes. */
export async function confirmTwoFactor(restaurantId: string, userId: string, token: string): Promise<ConfirmResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true },
  });
  if (!user || !user.twoFactorSecret) return { ok: false, error: "Start enrollment first" };
  if (user.twoFactorEnabledAt) return { ok: false, error: "Two-factor is already enabled" };
  if (!(await verifyTotp(user.twoFactorSecret, token))) return { ok: false, error: "Incorrect code" };

  const codes = generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabledAt: new Date(), twoFactorBackupCodes: await hashBackupCodes(codes) },
  });
  return { ok: true, backupCodes: codes };
}

/** Turn off 2FA and wipe the secret + recovery codes. */
export async function disableTwoFactor(restaurantId: string, userId: string): Promise<{ ok: boolean }> {
  const res = await prisma.user.updateMany({
    where: { id: userId, restaurantId },
    data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorBackupCodes: [] },
  });
  return { ok: res.count > 0 };
}

export interface TwoFactorCheck {
  ok: boolean;
  required: boolean;
  method?: "totp" | "backup";
}

/**
 * Login step-up check. If the user has 2FA enabled, validate the supplied code
 * (TOTP or a single-use backup code, which is consumed on use). When 2FA is not
 * enabled, `required` is false and `ok` is true.
 */
export async function verifyTwoFactor(restaurantId: string, userId: string, code: string | undefined): Promise<TwoFactorCheck> {
  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true, twoFactorBackupCodes: true },
  });
  if (!user || !user.twoFactorEnabledAt || !user.twoFactorSecret) return { ok: true, required: false };
  if (!code) return { ok: false, required: true };

  if (await verifyTotp(user.twoFactorSecret, code)) return { ok: true, required: true, method: "totp" };

  const consumed = await consumeBackupCode(user.twoFactorBackupCodes, code);
  if (consumed.ok) {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: consumed.remaining } });
    return { ok: true, required: true, method: "backup" };
  }
  return { ok: false, required: true };
}

export function isTwoFactorEnabled(user: { twoFactorEnabledAt: Date | null }): boolean {
  return user.twoFactorEnabledAt != null;
}
