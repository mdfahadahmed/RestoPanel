import type { InvoiceStatus, Prisma } from "@prisma/client";
import { Prisma as P } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Local invoice records — the tenant-facing payment history & document list. */

function generateInvoiceNumber(now: Date): string {
  const y = now.getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${y}-${rand}`;
}

export interface RecordInvoiceInput {
  restaurantId: string;
  subscriptionId?: string | null;
  amount: number;
  currency?: string;
  status?: InvoiceStatus;
  description?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt?: Date | null;
  issuedAt?: Date;
  stripeInvoiceId?: string | null;
  hostedUrl?: string | null;
  pdfUrl?: string | null;
}

/**
 * Create an invoice. Idempotent on `stripeInvoiceId` when provided so webhook
 * retries never duplicate a charge.
 */
export async function recordInvoice(input: RecordInvoiceInput) {
  if (input.stripeInvoiceId) {
    const existing = await prisma.invoice.findUnique({
      where: { stripeInvoiceId: input.stripeInvoiceId },
    });
    if (existing) {
      // Sync status/paid timestamp on retry.
      return prisma.invoice.update({
        where: { id: existing.id },
        data: {
          status: input.status ?? existing.status,
          paidAt: input.paidAt ?? existing.paidAt,
          hostedUrl: input.hostedUrl ?? existing.hostedUrl,
          pdfUrl: input.pdfUrl ?? existing.pdfUrl,
        },
      });
    }
  }

  const now = input.issuedAt ?? new Date();
  // Retry a couple of times on the (extremely unlikely) number collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.invoice.create({
        data: {
          restaurantId: input.restaurantId,
          subscriptionId: input.subscriptionId ?? null,
          number: generateInvoiceNumber(now),
          amount: new P.Decimal(input.amount),
          currency: input.currency ?? "GBP",
          status: input.status ?? "OPEN",
          description: input.description ?? null,
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
          issuedAt: now,
          paidAt: input.paidAt ?? null,
          stripeInvoiceId: input.stripeInvoiceId ?? null,
          hostedUrl: input.hostedUrl ?? null,
          pdfUrl: input.pdfUrl ?? null,
        },
      });
    } catch (e) {
      if (
        e instanceof P.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        attempt < 4
      ) {
        continue; // number collision — regenerate
      }
      throw e;
    }
  }
  throw new Error("Could not allocate a unique invoice number");
}

export async function listInvoicesForRestaurant(restaurantId: string) {
  return prisma.invoice.findMany({
    where: { restaurantId },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
}

export async function markInvoicePaidByStripeId(
  stripeInvoiceId: string,
  paidAt: Date,
  links?: { hostedUrl?: string | null; pdfUrl?: string | null }
) {
  const where: Prisma.InvoiceWhereUniqueInput = { stripeInvoiceId };
  const existing = await prisma.invoice.findUnique({ where });
  if (!existing) return null;
  return prisma.invoice.update({
    where,
    data: { status: "PAID", paidAt, hostedUrl: links?.hostedUrl ?? existing.hostedUrl, pdfUrl: links?.pdfUrl ?? existing.pdfUrl },
  });
}
