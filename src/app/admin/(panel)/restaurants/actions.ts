"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  suspendRestaurant,
  activateRestaurant,
  softDeleteRestaurant,
} from "@/lib/admin/restaurants";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

export async function suspendRestaurantAction(
  id: string,
  reason?: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing restaurant id.");
  await suspendRestaurant(id, reason);
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  return actionOk();
}

export async function activateRestaurantAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing restaurant id.");
  await activateRestaurant(id);
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  return actionOk();
}

export async function deleteRestaurantAction(id: string): Promise<ActionResult> {
  // Deleting tenants is destructive — restrict to SUPER_ADMIN.
  await requireAdmin(["SUPER_ADMIN"]);
  if (!id) return actionError("Missing restaurant id.");
  await softDeleteRestaurant(id);
  revalidatePath("/admin/restaurants");
  return actionOk();
}
