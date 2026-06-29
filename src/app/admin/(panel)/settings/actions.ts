"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { savePlatformSettings } from "@/lib/admin/settings";
import { platformSettingsSchema } from "@/lib/validations/admin";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

export async function savePlatformSettingsAction(
  input: unknown
): Promise<ActionResult> {
  // Platform integration secrets — SUPER_ADMIN only.
  await requireSuperAdmin();
  const parsed = platformSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Validation failed", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  await savePlatformSettings(parsed.data);
  revalidatePath("/admin/settings");
  return actionOk();
}
