"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import { setSubscriptionStatus } from "@/lib/admin/subscriptions";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

export async function setSubscriptionStatusAction(
  id: string,
  status: SubscriptionStatus
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing subscription id.");
  await setSubscriptionStatus(id, status);
  revalidatePath("/admin/subscriptions");
  return actionOk();
}
