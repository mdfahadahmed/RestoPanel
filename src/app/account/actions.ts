"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { requireCustomer } from "@/lib/account/context";
import {
  setCustomerSessionCookie,
  clearCustomerSessionCookie,
} from "@/lib/account/context";
import * as service from "@/lib/account/service";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/account/email";
import { recordCustomerLogin } from "@/lib/account/login-history";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { isTrustedOrigin } from "@/lib/security/origin";
import {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
} from "@/lib/security/email-verification";
import {
  addressSchema,
  changePasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "@/lib/validations/account";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Per-request auth context (IP, user agent, headers) for security controls. */
async function authContext() {
  const h = await headers();
  return { headers: h, ip: getClientIp(h), userAgent: h.get("user-agent") };
}

/**
 * CSRF + rate-limit gate for auth actions. Returns an error result to short-
 * circuit, or null to proceed. `buckets` are checked in order (e.g. per-IP and
 * per-email); the first exhausted one blocks.
 */
async function authGuard(
  h: Headers,
  buckets: { key: string; limit: number }[]
): Promise<ActionResult | null> {
  if (!isTrustedOrigin(h)) {
    return actionError("Your session couldn't be verified. Please refresh and try again.");
  }
  for (const b of buckets) {
    const res = await checkRateLimit(b.key, b.limit);
    if (!res.allowed) {
      return actionError("Too many attempts. Please wait a minute and try again.");
    }
  }
  return null;
}

/** Fire the verification email for a freshly-created customer (best-effort). */
async function dispatchCustomerVerification(accountId: string, email: string, name: string) {
  try {
    const rawToken = await createEmailVerificationToken("customer", accountId, email);
    const origin = await resolveOrigin();
    await sendVerificationEmail({
      to: email,
      name,
      verifyUrl: `${origin}/account/verify-email?token=${rawToken}`,
    });
  } catch {
    /* verification is non-blocking — never fail registration on it */
  }
}

export async function registerCustomer(input: unknown): Promise<ActionResult> {
  const parsed = customerRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const { headers: h, ip, userAgent } = await authContext();
  const blocked = await authGuard(h, [{ key: `acct:register:ip:${ip ?? "?"}`, limit: 5 }]);
  if (blocked) return blocked;

  const result = await service.registerAccount(parsed.data);
  if (!result.ok) return result;

  await setCustomerSessionCookie(result.data!);
  await recordCustomerLogin({
    accountId: result.data!.id,
    email: parsed.data.email,
    success: true,
    reason: "register",
    ip,
    userAgent,
  });
  await dispatchCustomerVerification(result.data!.id, parsed.data.email, parsed.data.name);
  return actionOk();
}

export async function loginCustomer(input: unknown): Promise<ActionResult> {
  const parsed = customerLoginSchema.safeParse(input);
  if (!parsed.success) return actionError("Enter a valid email and password");

  const { headers: h, ip, userAgent } = await authContext();
  const blocked = await authGuard(h, [
    { key: `acct:login:ip:${ip ?? "?"}`, limit: 10 },
    { key: `acct:login:email:${parsed.data.email}`, limit: 5 },
  ]);
  if (blocked) return blocked;

  const result = await service.authenticateAccount(
    parsed.data.email,
    parsed.data.password
  );
  if (!result.ok) {
    await recordCustomerLogin({
      email: parsed.data.email,
      success: false,
      reason: "bad_credentials",
      ip,
      userAgent,
    });
    return result;
  }

  await setCustomerSessionCookie(result.data!);
  await recordCustomerLogin({
    accountId: result.data!.id,
    email: parsed.data.email,
    success: true,
    ip,
    userAgent,
  });
  return actionOk();
}

export async function logoutCustomer(): Promise<ActionResult> {
  await clearCustomerSessionCookie();
  return actionOk();
}

/** Resolve the public origin for building absolute links (reset emails, etc.). */
async function resolveOrigin(): Promise<string> {
  const envUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/**
 * Start the password-reset flow. Always returns success — we never reveal
 * whether an email is registered. When the account exists we mint a token and
 * email a reset link; delivery failures are swallowed for the same reason.
 */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return actionError("Enter a valid email");

  const { headers: h, ip } = await authContext();
  const blocked = await authGuard(h, [
    { key: `acct:reset-req:ip:${ip ?? "?"}`, limit: 5 },
    { key: `acct:reset-req:email:${parsed.data.email}`, limit: 3 },
  ]);
  if (blocked) return blocked;

  const request = await service.beginPasswordReset(parsed.data.email);
  if (request) {
    const origin = await resolveOrigin();
    const resetUrl = `${origin}/account/reset-password?token=${request.rawToken}`;
    await sendPasswordResetEmail({
      to: request.email,
      name: request.name,
      resetUrl,
    });
  }
  return actionOk();
}

/** Complete the password-reset flow with a token + new password. */
export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const { headers: h, ip } = await authContext();
  const blocked = await authGuard(h, [{ key: `acct:reset:ip:${ip ?? "?"}`, limit: 10 }]);
  if (blocked) return blocked;

  return service.resetPassword(parsed.data.token, parsed.data.password);
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

/** Consume a verification token (from the emailed link). Public — no session. */
export async function verifyEmailToken(token: string): Promise<ActionResult> {
  if (!token || typeof token !== "string") return actionError("Invalid verification link");
  const { headers: h } = await authContext();
  const blocked = await authGuard(h, [{ key: `acct:verify:token`, limit: 60 }]);
  if (blocked) return blocked;

  const result = await consumeEmailVerificationToken(token);
  if (!result.ok) {
    return actionError("This verification link is invalid or has expired.");
  }
  revalidatePath("/account");
  return actionOk();
}

/** Re-send the verification email to the signed-in customer (rate-limited). */
export async function resendVerificationEmail(): Promise<ActionResult> {
  const { accountId, email, name } = await requireCustomer();

  const { headers: h } = await authContext();
  const blocked = await authGuard(h, [{ key: `acct:verify-resend:${accountId}`, limit: 3 }]);
  if (blocked) return blocked;

  const account = await service.getAccountSettings(accountId);
  if (account && "emailVerifiedAt" in account && account.emailVerifiedAt) {
    return actionOk(); // already verified — nothing to do
  }
  await dispatchCustomerVerification(accountId, email, name);
  return actionOk();
}

// ---------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const result = await service.updateProfile(accountId, parsed.data);
  if (result.ok) revalidatePath("/account/profile");
  return result;
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const { accountId, email } = await requireCustomer();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const result = await service.changePassword(accountId, parsed.data);
  if (!result.ok) return result;

  // Password change bumped tokenVersion (killing other sessions) — re-issue this
  // session's cookie so the current user stays signed in.
  await setCustomerSessionCookie({
    id: accountId,
    email,
    tokenVersion: result.data!.tokenVersion,
  });
  return actionOk();
}

export async function updateSettings(input: unknown): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid settings");
  const result = await service.updateSettings(accountId, parsed.data);
  if (result.ok) {
    revalidatePath("/account/settings");
    revalidatePath("/account");
  }
  return result;
}

export async function signOutEverywhere(): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  await service.bumpTokenVersion(accountId);
  await clearCustomerSessionCookie();
  return actionOk();
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export async function addAddress(input: unknown): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const result = await service.addAddress(accountId, parsed.data);
  if (result.ok) revalidatePath("/account/addresses");
  return result;
}

export async function updateAddress(
  addressId: string,
  input: unknown
): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const result = await service.updateAddress(accountId, addressId, parsed.data);
  if (result.ok) revalidatePath("/account/addresses");
  return result;
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.deleteAddress(accountId, addressId);
  if (result.ok) revalidatePath("/account/addresses");
  return result;
}

export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.setDefaultAddress(accountId, addressId);
  if (result.ok) revalidatePath("/account/addresses");
  return result;
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function addFavorite(productId: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.addFavorite(accountId, String(productId));
  if (result.ok) revalidatePath("/account/favorites");
  return result;
}

export async function removeFavorite(productId: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.removeFavorite(accountId, String(productId));
  if (result.ok) revalidatePath("/account/favorites");
  return result;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.markNotificationRead(accountId, String(id));
  if (result.ok) {
    revalidatePath("/account/notifications");
    revalidatePath("/account");
  }
  return result;
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.markAllNotificationsRead(accountId);
  if (result.ok) {
    revalidatePath("/account/notifications");
    revalidatePath("/account");
  }
  return result;
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const { accountId } = await requireCustomer();
  const result = await service.deleteNotification(accountId, String(id));
  if (result.ok) revalidatePath("/account/notifications");
  return result;
}
