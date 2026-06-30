import { prisma } from "@/lib/prisma";
import {
  isPushConfigured,
  sendViaExpo,
  type PushPayload,
  type PushSendResult,
} from "@/lib/notifications/providers/push";

/**
 * Send push notifications to a tenant's registered mobile devices. Resolves the
 * live push tokens (active, non-revoked, non-expired devices) and dispatches via
 * the configured provider; when none is configured the send is reported as
 * SKIPPED rather than failing — matching the email/SMS behaviour.
 */

export interface PushDispatchResult extends PushSendResult {
  targeted: number; // number of device tokens resolved
  skipped: number; // tokens not sent because no provider is configured
}

/** Live push tokens for a tenant, optionally narrowed to one user. */
export async function resolvePushTokens(restaurantId: string, userId?: string): Promise<string[]> {
  const devices = await prisma.mobileDevice.findMany({
    where: {
      restaurantId,
      ...(userId ? { userId } : {}),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      pushToken: { not: null },
    },
    select: { pushToken: true },
  });
  const tokens = devices.map((d) => d.pushToken).filter((t): t is string => !!t);
  return [...new Set(tokens)];
}

async function dispatch(tokens: string[], payload: PushPayload): Promise<PushDispatchResult> {
  if (tokens.length === 0) return { ok: true, sent: 0, targeted: 0, skipped: 0 };
  if (!isPushConfigured()) return { ok: true, sent: 0, targeted: tokens.length, skipped: tokens.length };
  const result = await sendViaExpo(tokens, payload);
  return { ...result, targeted: tokens.length, skipped: 0 };
}

/** Push to every active device of a single staff member. */
export async function sendPushToUser(
  restaurantId: string,
  userId: string,
  payload: PushPayload
): Promise<PushDispatchResult> {
  return dispatch(await resolvePushTokens(restaurantId, userId), payload);
}

/** Push to every active device in the restaurant (e.g. "new order" to all staff). */
export async function sendPushToRestaurant(
  restaurantId: string,
  payload: PushPayload
): Promise<PushDispatchResult> {
  return dispatch(await resolvePushTokens(restaurantId), payload);
}
