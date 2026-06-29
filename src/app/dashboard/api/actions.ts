"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { createApiKey, revokeApiKey, deleteApiKey } from "@/lib/api/keys";
import { API_SCOPES } from "@/lib/api/scopes";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Select at least one scope"),
  rateLimitPerMin: z.coerce.number().int().min(1).max(6000).default(60),
});

export async function createApiKeyAction(
  input: unknown
): Promise<ActionResult<{ id: string; plaintext: string; prefix: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const { apiKey, plaintext } = await createApiKey({
    restaurantId,
    name: parsed.data.name,
    scopes: parsed.data.scopes,
    rateLimitPerMin: parsed.data.rateLimitPerMin,
  });

  revalidatePath("/dashboard/api");
  return actionOk({ id: apiKey.id, plaintext, prefix: apiKey.prefix });
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const ok = await revokeApiKey(restaurantId, id);
  if (!ok) return actionError("API key not found");
  revalidatePath("/dashboard/api");
  return actionOk();
}

export async function deleteApiKeyAction(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const ok = await deleteApiKey(restaurantId, id);
  if (!ok) return actionError("API key not found");
  revalidatePath("/dashboard/api");
  return actionOk();
}
