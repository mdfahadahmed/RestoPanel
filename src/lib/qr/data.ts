import type { QrType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateQrSlug, resolveTargetPath } from "./urls";

/**
 * QR code persistence. Pure, tenant-scoped functions (restaurantId passed in)
 * so the dashboard server actions wrap them with requireTenant() and tests can
 * call them directly.
 */

export interface CreateQrInput {
  restaurantId: string;
  label: string;
  type: QrType;
  tableNumber?: number | null;
  targetPath?: string | null;
  isDynamic?: boolean;
  logoEnabled?: boolean;
}

export async function createQrCode(input: CreateQrInput) {
  // DYNAMIC codes must redirect (so they can be re-pointed); others may opt in.
  const isDynamic = input.type === "DYNAMIC" ? true : Boolean(input.isDynamic);

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.qrCode.create({
        data: {
          restaurantId: input.restaurantId,
          label: input.label,
          type: input.type,
          code: generateQrSlug(),
          tableNumber: input.type === "TABLE" ? input.tableNumber ?? null : null,
          targetPath: input.type === "DYNAMIC" ? input.targetPath?.trim() || null : null,
          isDynamic,
          logoEnabled: input.logoEnabled ?? true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 5) {
        continue; // code collision — regenerate
      }
      throw e;
    }
  }
  throw new Error("Could not allocate a unique QR code");
}

export async function listQrCodes(restaurantId: string) {
  return prisma.qrCode.findMany({
    where: { restaurantId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
}

export async function getQrCode(restaurantId: string, id: string) {
  return prisma.qrCode.findFirst({ where: { id, restaurantId } });
}

export interface UpdateQrInput {
  label?: string;
  tableNumber?: number | null;
  targetPath?: string | null;
  isDynamic?: boolean;
  logoEnabled?: boolean;
  isActive?: boolean;
}

export async function updateQrCode(restaurantId: string, id: string, data: UpdateQrInput) {
  const existing = await prisma.qrCode.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  return prisma.qrCode.update({
    where: { id: existing.id },
    data: {
      label: data.label ?? existing.label,
      tableNumber:
        existing.type === "TABLE"
          ? data.tableNumber !== undefined
            ? data.tableNumber
            : existing.tableNumber
          : existing.tableNumber,
      targetPath:
        existing.type === "DYNAMIC"
          ? data.targetPath !== undefined
            ? data.targetPath?.trim() || null
            : existing.targetPath
          : existing.targetPath,
      // DYNAMIC stays dynamic; others may toggle tracking on/off.
      isDynamic: existing.type === "DYNAMIC" ? true : data.isDynamic ?? existing.isDynamic,
      logoEnabled: data.logoEnabled ?? existing.logoEnabled,
      isActive: data.isActive ?? existing.isActive,
    },
  });
}

export async function deleteQrCode(restaurantId: string, id: string) {
  const res = await prisma.qrCode.deleteMany({ where: { id, restaurantId } });
  return res.count > 0;
}

export interface ScanResolution {
  restaurantId: string;
  slug: string;
  targetPath: string;
}

/**
 * Resolve a /q/<code> scan: returns the storefront path to redirect to and
 * records the scan. Returns null when the code is unknown or inactive.
 */
export async function resolveScan(
  code: string,
  now: Date = new Date()
): Promise<ScanResolution | null> {
  const qr = await prisma.qrCode.findUnique({
    where: { code },
    include: { restaurant: { select: { slug: true } } },
  });
  if (!qr || !qr.isActive) return null;

  // Record the scan (best-effort; resolution must not fail if this does).
  await prisma.qrCode
    .update({
      where: { id: qr.id },
      data: { scanCount: { increment: 1 }, lastScannedAt: now },
    })
    .catch(() => undefined);

  return {
    restaurantId: qr.restaurantId,
    slug: qr.restaurant.slug,
    targetPath: resolveTargetPath(qr, qr.restaurant.slug),
  };
}
