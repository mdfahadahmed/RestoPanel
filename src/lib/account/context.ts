import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  signCustomerToken,
  verifyCustomerToken,
} from "./session";

export interface CustomerContext {
  accountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  theme: string;
  language: string;
}

/**
 * Resolve the signed-in customer account from the session cookie. Verifies the
 * token signature/expiry AND that its version still matches the account (so
 * "sign out everywhere" — which bumps `tokenVersion` — invalidates old cookies).
 * Returns `null` when there is no valid session.
 *
 * Always derive `accountId` from here — never trust a client-supplied id — so
 * every customer query stays scoped to the authenticated account.
 */
export async function getCustomerSession(): Promise<CustomerContext | null> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  const payload = await verifyCustomerToken(token);
  if (!payload) return null;

  const account = await prisma.customerAccount.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      theme: true,
      language: true,
      tokenVersion: true,
    },
  });
  if (!account || account.tokenVersion !== payload.ver) return null;

  return {
    accountId: account.id,
    email: account.email,
    name: account.name,
    avatarUrl: account.avatarUrl,
    theme: account.theme,
    language: account.language,
  };
}

/** Require an authenticated customer or redirect to the account login page. */
export async function requireCustomer(): Promise<CustomerContext> {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  return session;
}

/** Issue the session cookie for an account (used after register/login). */
export async function setCustomerSessionCookie(account: {
  id: string;
  email: string;
  tokenVersion: number;
}): Promise<void> {
  const token = await signCustomerToken({
    sub: account.id,
    email: account.email,
    ver: account.tokenVersion,
  });
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE,
  });
}

/** Clear the session cookie (logout). */
export async function clearCustomerSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(CUSTOMER_COOKIE);
}
