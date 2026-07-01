"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { requireCustomer } from "@/lib/account/context";
import {
  setCustomerSessionCookie,
  clearCustomerSessionCookie,
} from "@/lib/account/context";
import * as service from "@/lib/account/service";
import {
  addressSchema,
  changePasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "@/lib/validations/account";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function registerCustomer(input: unknown): Promise<ActionResult> {
  const parsed = customerRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const result = await service.registerAccount(parsed.data);
  if (!result.ok) return result;

  await setCustomerSessionCookie(result.data!);
  return actionOk();
}

export async function loginCustomer(input: unknown): Promise<ActionResult> {
  const parsed = customerLoginSchema.safeParse(input);
  if (!parsed.success) return actionError("Enter a valid email and password");

  const result = await service.authenticateAccount(
    parsed.data.email,
    parsed.data.password
  );
  if (!result.ok) return result;

  await setCustomerSessionCookie(result.data!);
  return actionOk();
}

export async function logoutCustomer(): Promise<ActionResult> {
  await clearCustomerSessionCookie();
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
