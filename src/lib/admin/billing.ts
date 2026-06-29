import type { Prisma, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Invoices / billing data for the admin Billing module. */

export async function listInvoices(filters: {
  status?: InvoiceStatus | "ALL";
  page?: number;
  perPage?: number;
} = {}) {
  const { status = "ALL", page = 1, perPage = 25 } = filters;
  const where: Prisma.InvoiceWhereInput = {};
  if (status !== "ALL") where.status = status;

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { restaurant: { select: { name: true, slug: true } } },
    }),
  ]);
  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export interface BillingSummary {
  paidTotal: number;
  outstanding: number;
  paidCount: number;
  openCount: number;
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const [paid, open] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "PAID" },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "OPEN" },
    }),
  ]);
  return {
    paidTotal: Number(paid._sum.amount ?? 0),
    outstanding: Number(open._sum.amount ?? 0),
    paidCount: paid._count,
    openCount: open._count,
  };
}

export async function markInvoicePaid(id: string, now: Date = new Date()) {
  return prisma.invoice.update({
    where: { id },
    data: { status: "PAID", paidAt: now },
  });
}

export async function voidInvoice(id: string) {
  return prisma.invoice.update({ where: { id }, data: { status: "VOID" } });
}
