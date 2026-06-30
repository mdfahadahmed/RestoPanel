import { prisma } from "@/lib/prisma";

/**
 * Session & device management for staff. Active sessions are the user's
 * MobileDevice rows (token sessions); revoking one invalidates that device's
 * refresh/access tokens immediately (see `lib/mobile/auth.ts`). Bumping the
 * user's `tokenVersion` is the "log out everywhere" signal for web sessions.
 */

export interface SessionView {
  id: string;
  platform: string;
  deviceName: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  current: boolean;
}

/** The user's active (non-revoked, non-expired) device sessions. */
export async function listSessions(
  restaurantId: string,
  userId: string,
  currentDeviceId?: string
): Promise<SessionView[]> {
  const devices = await prisma.mobileDevice.findMany({
    where: { restaurantId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, platform: true, deviceName: true, lastSeenAt: true, createdAt: true },
  });
  return devices.map((d) => ({ ...d, current: d.id === currentDeviceId }));
}

export type SessionResult = { ok: true } | { ok: false; error: string };

/** Revoke a single session/device (scoped to the owning user). */
export async function revokeSession(restaurantId: string, userId: string, deviceId: string): Promise<SessionResult> {
  const res = await prisma.mobileDevice.updateMany({
    where: { id: deviceId, restaurantId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0 ? { ok: true } : { ok: false, error: "Session not found" };
}

/** Rename a device session. */
export async function renameSession(
  restaurantId: string,
  userId: string,
  deviceId: string,
  name: string
): Promise<SessionResult> {
  const res = await prisma.mobileDevice.updateMany({
    where: { id: deviceId, restaurantId, userId },
    data: { deviceName: name.trim() || null },
  });
  return res.count > 0 ? { ok: true } : { ok: false, error: "Session not found" };
}

/**
 * Revoke every session for a user (optionally keeping the current device) and
 * bump `tokenVersion` so any web JWT is invalidated too. Returns how many device
 * sessions were revoked.
 */
export async function revokeAllSessions(
  restaurantId: string,
  userId: string,
  exceptDeviceId?: string
): Promise<{ revoked: number }> {
  const [devices] = await prisma.$transaction([
    prisma.mobileDevice.updateMany({
      where: {
        restaurantId,
        userId,
        revokedAt: null,
        ...(exceptDeviceId ? { id: { not: exceptDeviceId } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
    prisma.user.updateMany({ where: { id: userId, restaurantId }, data: { tokenVersion: { increment: 1 } } }),
  ]);
  return { revoked: devices.count };
}
