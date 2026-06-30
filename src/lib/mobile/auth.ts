import bcrypt from "bcryptjs";
import type { MobilePlatform, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api/keys";
import {
  signMobileToken,
  verifyMobileToken,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
} from "@/lib/mobile/token";
import { checkRateLimit, resetRateLimit } from "@/lib/security/ratelimit";
import { recordLogin } from "@/lib/security/login-history";
import { verifyTwoFactor } from "@/lib/security/twofactor";

/** Per-minute login attempt caps (brute-force protection). */
const MAX_ATTEMPTS_PER_EMAIL = 10;
const MAX_ATTEMPTS_PER_IP = 30;

/**
 * Mobile authentication for staff (the `User` model). Login verifies the bcrypt
 * password (reused from the web auth), then issues a short-lived access token
 * plus an opaque refresh token whose hash is stored on a MobileDevice row so it
 * can be rotated and revoked.
 */

export interface DeviceInfo {
  platform?: MobilePlatform;
  deviceName?: string | null;
  pushToken?: string | null;
}

export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
  twoFactorCode?: string;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `mr_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

function refreshExpiry(now = Date.now()): Date {
  return new Date(now + REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000);
}

export interface MobileSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access-token TTL seconds
  deviceId: string;
  user: { id: string; name: string; email: string; role: Role };
  restaurant: { id: string; name: string; slug: string };
}

export type LoginResult =
  | { ok: true; session: MobileSession }
  | { ok: false; error: string; twoFactorRequired?: boolean };

/** Authenticate a staff member and open a mobile device session. */
export async function loginMobile(
  email: string,
  password: string,
  device: DeviceInfo = {},
  ctx: LoginContext = {}
): Promise<LoginResult> {
  const lower = email.trim().toLowerCase();
  const ip = ctx.ip ?? null;
  const userAgent = ctx.userAgent ?? null;
  const fail = async (error: string, reason: string, ids?: { restaurantId?: string; userId?: string }, twoFactorRequired?: boolean): Promise<LoginResult> => {
    await recordLogin({ email: lower, method: "mobile", success: false, reason, ip, userAgent, ...ids });
    return { ok: false, error, ...(twoFactorRequired ? { twoFactorRequired } : {}) };
  };

  // Brute-force throttling per email + per IP.
  const emailRl = await checkRateLimit(`login:email:${lower}`, MAX_ATTEMPTS_PER_EMAIL);
  const ipRl = ip ? await checkRateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP) : null;
  if (!emailRl.allowed || (ipRl && !ipRl.allowed)) {
    return fail("Too many attempts. Please wait a minute and try again.", "rate_limited");
  }

  const user = await prisma.user.findUnique({
    where: { email: lower },
    include: { restaurant: { select: { id: true, name: true, slug: true, status: true } } },
  });
  if (!user) return fail("Invalid email or password", "unknown_user");
  if (!user.isActive) return fail("This account is deactivated", "inactive", { restaurantId: user.restaurantId, userId: user.id });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return fail("Invalid email or password", "bad_password", { restaurantId: user.restaurantId, userId: user.id });

  // Two-factor step-up (no-op when the user hasn't enabled 2FA).
  const tf = await verifyTwoFactor(user.restaurantId, user.id, ctx.twoFactorCode);
  if (!tf.ok) {
    return fail(
      ctx.twoFactorCode ? "Invalid two-factor code" : "Two-factor code required",
      "twofactor",
      { restaurantId: user.restaurantId, userId: user.id },
      true
    );
  }

  const refreshToken = randomToken();
  const deviceRow = await prisma.mobileDevice.create({
    data: {
      restaurantId: user.restaurantId,
      userId: user.id,
      platform: device.platform ?? "ANDROID",
      deviceName: device.deviceName ?? null,
      pushToken: device.pushToken ?? null,
      refreshTokenHash: await hashApiKey(refreshToken),
      expiresAt: refreshExpiry(),
      lastSeenAt: new Date(),
    },
    select: { id: true },
  });

  const accessToken = await signMobileToken({
    sub: user.id,
    rid: user.restaurantId,
    did: deviceRow.id,
    role: user.role,
  });

  // Successful login — clear the throttle, stamp last login, record history.
  await resetRateLimit(`login:email:${lower}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  await recordLogin({
    restaurantId: user.restaurantId,
    userId: user.id,
    email: lower,
    method: tf.method === "totp" || tf.method === "backup" ? "totp" : "mobile",
    success: true,
    ip,
    userAgent,
  });

  return {
    ok: true,
    session: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL,
      deviceId: deviceRow.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      restaurant: { id: user.restaurant.id, name: user.restaurant.name, slug: user.restaurant.slug },
    },
  };
}

export type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string; expiresIn: number }
  | { ok: false; error: string };

/** Rotate a refresh token and mint a new access token. */
export async function refreshMobile(refreshToken: string): Promise<RefreshResult> {
  if (!refreshToken) return { ok: false, error: "Missing refresh token" };
  const hash = await hashApiKey(refreshToken);
  const device = await prisma.mobileDevice.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: { select: { id: true, role: true, isActive: true, restaurantId: true } } },
  });
  if (!device || device.revokedAt) return { ok: false, error: "Invalid refresh token" };
  if (device.expiresAt.getTime() < Date.now()) return { ok: false, error: "Session expired" };
  if (!device.user.isActive) return { ok: false, error: "This account is deactivated" };

  const nextRefresh = randomToken();
  await prisma.mobileDevice.update({
    where: { id: device.id },
    data: { refreshTokenHash: await hashApiKey(nextRefresh), expiresAt: refreshExpiry(), lastSeenAt: new Date() },
  });

  const accessToken = await signMobileToken({
    sub: device.user.id,
    rid: device.user.restaurantId,
    did: device.id,
    role: device.user.role,
  });
  return { ok: true, accessToken, refreshToken: nextRefresh, expiresIn: ACCESS_TOKEN_TTL };
}

/** Revoke a device session (logout). Idempotent. */
export async function logoutMobile(refreshToken: string): Promise<{ ok: boolean }> {
  if (!refreshToken) return { ok: false };
  const hash = await hashApiKey(refreshToken);
  const res = await prisma.mobileDevice.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { ok: res.count > 0 };
}

export interface MobileContext {
  userId: string;
  restaurantId: string;
  role: Role;
  deviceId: string;
}

function parseBearer(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Resolve a mobile access token (Bearer) to its context. Verifies the HMAC
 * signature + expiry AND that the device session is still active (so logout
 * takes effect immediately). Returns null on any failure → caller maps to 401.
 */
export async function authenticateMobile(headers: Headers): Promise<MobileContext | null> {
  const payload = await verifyMobileToken(parseBearer(headers));
  if (!payload) return null;

  const device = await prisma.mobileDevice.findUnique({
    where: { id: payload.did },
    select: { id: true, revokedAt: true, restaurantId: true, userId: true },
  });
  if (!device || device.revokedAt) return null;
  if (device.restaurantId !== payload.rid || device.userId !== payload.sub) return null;

  prisma.mobileDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);

  return { userId: payload.sub, restaurantId: payload.rid, role: payload.role, deviceId: payload.did };
}
