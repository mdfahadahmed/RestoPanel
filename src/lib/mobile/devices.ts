import type { MobilePlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Mobile device + push-token management. A device row is created at login
 * (see `lib/mobile/auth.ts`); here the app registers/updates the push token for
 * its current device, identified by the device id carried in the access token.
 */

export type DeviceResult = { ok: true } | { ok: false; error: string };

/** Register or update the push token for the caller's current device. */
export async function registerPushToken(
  restaurantId: string,
  deviceId: string,
  pushToken: string,
  platform?: MobilePlatform
): Promise<DeviceResult> {
  const token = pushToken.trim();
  if (!token) return { ok: false, error: "Push token is required" };

  const res = await prisma.mobileDevice.updateMany({
    where: { id: deviceId, restaurantId, revokedAt: null },
    data: { pushToken: token, ...(platform ? { platform } : {}), lastSeenAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: "Device not found" };
  return { ok: true };
}

/** Clear the push token for the caller's current device (stop receiving push). */
export async function unregisterPushToken(restaurantId: string, deviceId: string): Promise<DeviceResult> {
  const res = await prisma.mobileDevice.updateMany({
    where: { id: deviceId, restaurantId },
    data: { pushToken: null },
  });
  if (res.count === 0) return { ok: false, error: "Device not found" };
  return { ok: true };
}

/** The signed-in user's active devices (for a "manage devices" screen). */
export async function listDevices(restaurantId: string, userId: string) {
  return prisma.mobileDevice.findMany({
    where: { restaurantId, userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      platform: true,
      deviceName: true,
      lastSeenAt: true,
      createdAt: true,
      pushToken: true,
    },
  });
}
