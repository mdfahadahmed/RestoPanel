"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { getClientIp } from "@/lib/security/ip";
import { recordAudit } from "@/lib/security/audit";
import {
  startTwoFactorEnroll,
  confirmTwoFactor,
  disableTwoFactor,
} from "@/lib/security/twofactor";
import { revokeSession, revokeAllSessions, renameSession } from "@/lib/security/sessions";
import { deletePasskey, renamePasskey } from "@/lib/security/passkeys";

async function auditContext() {
  const h = await headers();
  return { ip: getClientIp(h), userAgent: h.get("user-agent") };
}

/** Begin TOTP enrollment — returns the secret + otpauth URI for the QR. */
export async function start2FA(): Promise<ActionResult<{ secret: string; otpauthUrl: string }>> {
  const { restaurantId, userId } = await requireTenant();
  const res = await startTwoFactorEnroll(restaurantId, userId);
  if (!res.ok) return actionError(res.error);
  return actionOk({ secret: res.secret, otpauthUrl: res.otpauthUrl });
}

/** Confirm enrollment with the first code — returns one-time backup codes. */
export async function confirm2FA(input: unknown): Promise<ActionResult<{ backupCodes: string[] }>> {
  const { restaurantId, userId, role } = await requireTenant();
  const parsed = z.object({ token: z.string().trim().min(6).max(10) }).safeParse(input);
  if (!parsed.success) return actionError("Enter the 6-digit code");

  const res = await confirmTwoFactor(restaurantId, userId, parsed.data.token);
  if (!res.ok) return actionError(res.error);

  const ctx = await auditContext();
  await recordAudit({ restaurantId, actorUserId: userId, action: "2fa.enable", targetType: "user", targetId: userId, ...ctx, metadata: { role } });
  revalidatePath("/dashboard/security");
  return actionOk({ backupCodes: res.backupCodes });
}

/** Disable 2FA for the current user. */
export async function disable2FA(): Promise<ActionResult> {
  const { restaurantId, userId } = await requireTenant();
  const res = await disableTwoFactor(restaurantId, userId);
  if (!res.ok) return actionError("Could not disable two-factor");

  const ctx = await auditContext();
  await recordAudit({ restaurantId, actorUserId: userId, action: "2fa.disable", targetType: "user", targetId: userId, ...ctx });
  revalidatePath("/dashboard/security");
  return actionOk();
}

/** Revoke a single device session. */
export async function revokeSessionAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, userId } = await requireTenant();
  const parsed = z.object({ deviceId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");

  const res = await revokeSession(restaurantId, userId, parsed.data.deviceId);
  if (!res.ok) return actionError(res.error);

  const ctx = await auditContext();
  await recordAudit({ restaurantId, actorUserId: userId, action: "session.revoke", targetType: "session", targetId: parsed.data.deviceId, ...ctx });
  revalidatePath("/dashboard/security");
  return actionOk();
}

/** Log out of all device sessions and invalidate web sessions. */
export async function revokeAllSessionsAction(): Promise<ActionResult<{ revoked: number }>> {
  const { restaurantId, userId } = await requireTenant();
  const res = await revokeAllSessions(restaurantId, userId);

  const ctx = await auditContext();
  await recordAudit({ restaurantId, actorUserId: userId, action: "session.revoke_all", targetType: "user", targetId: userId, ...ctx, metadata: { revoked: res.revoked } });
  revalidatePath("/dashboard/security");
  return actionOk({ revoked: res.revoked });
}

export async function renameSessionAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, userId } = await requireTenant();
  const parsed = z.object({ deviceId: z.string().min(1), name: z.string().trim().max(120) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const res = await renameSession(restaurantId, userId, parsed.data.deviceId, parsed.data.name);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/security");
  return actionOk();
}

export async function deletePasskeyAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, userId } = await requireTenant();
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const res = await deletePasskey(restaurantId, userId, parsed.data.id);
  if (!res.ok) return actionError(res.error);

  const ctx = await auditContext();
  await recordAudit({ restaurantId, actorUserId: userId, action: "passkey.delete", targetType: "passkey", targetId: parsed.data.id, ...ctx });
  revalidatePath("/dashboard/security");
  return actionOk();
}

export async function renamePasskeyAction(input: unknown): Promise<ActionResult> {
  const { restaurantId, userId } = await requireTenant();
  const parsed = z.object({ id: z.string().min(1), label: z.string().trim().max(80) }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  const res = await renamePasskey(restaurantId, userId, parsed.data.id, parsed.data.label);
  if (!res.ok) return actionError(res.error);
  revalidatePath("/dashboard/security");
  return actionOk();
}
