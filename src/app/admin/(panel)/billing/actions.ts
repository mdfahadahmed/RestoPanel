"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { markInvoicePaid, voidInvoice } from "@/lib/admin/billing";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

export async function markInvoicePaidAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing invoice id.");
  await markInvoicePaid(id);
  revalidatePath("/admin/billing");
  return actionOk();
}

export async function voidInvoiceAction(id: string): Promise<ActionResult> {
  await requireAdmin(["SUPER_ADMIN"]);
  if (!id) return actionError("Missing invoice id.");
  await voidInvoice(id);
  revalidatePath("/admin/billing");
  return actionOk();
}
