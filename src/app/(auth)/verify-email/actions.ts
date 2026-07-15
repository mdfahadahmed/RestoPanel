"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { consumeEmailVerificationToken } from "@/lib/security/email-verification";

/**
 * Consume an owner/staff email-verification token. The token carries its own
 * scope, so `consumeEmailVerificationToken` stamps the correct `User` row.
 */
export async function verifyOwnerEmail(token: string): Promise<ActionResult> {
  if (!token || typeof token !== "string") return actionError("Invalid verification link");
  const result = await consumeEmailVerificationToken(token);
  if (!result.ok) {
    return actionError("This verification link is invalid or has expired.");
  }
  return actionOk();
}
