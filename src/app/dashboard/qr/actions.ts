"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { createQrSchema, updateQrSchema, isSafeTargetPath } from "@/lib/validations/qr";
import {
  createQrCode,
  updateQrCode,
  deleteQrCode,
  getQrCode,
} from "@/lib/qr/data";
import { encodedUrl } from "@/lib/qr/urls";
import { renderQrSvg } from "@/lib/qr/render";

export async function createQrAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = createQrSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  if (d.type === "DYNAMIC" && d.targetPath && !isSafeTargetPath(d.targetPath)) {
    return actionError("Please fix the errors below", { targetPath: ["Use a path on your site, e.g. /r/your-menu"] });
  }

  const created = await createQrCode({
    restaurantId,
    label: d.label,
    type: d.type,
    tableNumber: d.tableNumber ?? null,
    targetPath: d.targetPath || null,
    isDynamic: d.isDynamic,
    logoEnabled: d.logoEnabled,
  });

  revalidatePath("/dashboard/qr");
  return actionOk({ id: created.id });
}

export async function updateQrAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = updateQrSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  if (d.targetPath && !isSafeTargetPath(d.targetPath)) {
    return actionError("Please fix the errors below", { targetPath: ["Use a path on your site, e.g. /r/your-menu"] });
  }

  const updated = await updateQrCode(restaurantId, d.id, {
    label: d.label,
    tableNumber: d.tableNumber,
    targetPath: d.targetPath,
    isDynamic: d.isDynamic,
    logoEnabled: d.logoEnabled,
    isActive: d.isActive,
  });
  if (!updated) return actionError("QR code not found");

  revalidatePath("/dashboard/qr");
  return actionOk();
}

export async function toggleQrAction(id: string, isActive: boolean): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const updated = await updateQrCode(restaurantId, id, { isActive });
  if (!updated) return actionError("QR code not found");
  revalidatePath("/dashboard/qr");
  return actionOk();
}

export async function deleteQrAction(id: string): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const ok = await deleteQrCode(restaurantId, id);
  if (!ok) return actionError("QR code not found");
  revalidatePath("/dashboard/qr");
  return actionOk();
}

/**
 * Render a QR code as an SVG string at the requested size for download/print.
 * Tenant-scoped; embeds the restaurant logo when the code has it enabled.
 */
export async function getQrSvgAction(
  id: string,
  opts?: { size?: number; rounded?: boolean; withLogo?: boolean }
): Promise<ActionResult<{ svg: string; filename: string; data: string }>> {
  const { restaurantId, restaurantSlug } = await requireTenant();
  const qr = await getQrCode(restaurantId, id);
  if (!qr) return actionError("QR code not found");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { logoUrl: true },
  });

  const data = encodedUrl(qr, restaurantSlug);
  const useLogo = (opts?.withLogo ?? true) && qr.logoEnabled && Boolean(restaurant?.logoUrl);
  const svg = renderQrSvg(data, {
    size: opts?.size ?? 1024,
    rounded: opts?.rounded ?? false,
    logoUrl: useLogo ? restaurant?.logoUrl ?? null : null,
  });

  const safeLabel = qr.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr";
  return actionOk({ svg, filename: `qr-${safeLabel}.svg`, data });
}
