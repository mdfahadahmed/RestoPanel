import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOrderItems, nextOrderNumber } from "@/lib/orders/build";
import { computeTotals, round2, type OrderItemInput } from "@/lib/validations/order";
import { apiCreateOrderSchema } from "@/lib/validations/api";
import { ApiResponse, ok, created, apiError, paginated, API_VERSION } from "./respond";
import {
  serializeRestaurant,
  serializeProduct,
  serializeCategory,
  serializeOrder,
  serializeCustomer,
} from "./serialize";

/**
 * Pure v1 endpoint functions. Each receives an authenticated context (the
 * resolved restaurant + scopes) and returns an ApiResponse. Scope enforcement
 * and rate limiting happen in the route guard (handle.ts); these assume the
 * caller is authorised, so they can be unit-tested directly.
 */

export interface ApiContext {
  restaurantId: string;
  scopes: string[];
}

export interface ListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
  available?: boolean;
  status?: string;
}

function pagination(q: ListQuery) {
  const page = Math.max(1, Math.floor(q.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(q.perPage ?? 20)));
  return { page, perPage, skip: (page - 1) * perPage };
}

// --- Meta ------------------------------------------------------------------
export function apiIndex(): ApiResponse {
  return ok({
    name: "RestoPanel API",
    version: API_VERSION,
    documentation: "/docs",
    openapi: "/api/v1/openapi.json",
    resources: ["restaurant", "products", "categories", "orders", "customers"],
  });
}

// --- Restaurant ------------------------------------------------------------
export async function getRestaurant(ctx: ApiContext): Promise<ApiResponse> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: ctx.restaurantId } });
  if (!restaurant) return apiError(404, "not_found", "Restaurant not found");
  return ok({ data: serializeRestaurant(restaurant) });
}

// --- Products --------------------------------------------------------------
export async function listProducts(ctx: ApiContext, q: ListQuery = {}): Promise<ApiResponse> {
  const { page, perPage, skip } = pagination(q);
  const where: Prisma.ProductWhereInput = { restaurantId: ctx.restaurantId, deletedAt: null };
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.available !== undefined) where.isAvailable = q.available;
  if (q.search?.trim()) where.name = { contains: q.search.trim(), mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: perPage }),
  ]);
  return paginated(rows.map(serializeProduct), { page, perPage, total });
}

export async function getProduct(ctx: ApiContext, id: string): Promise<ApiResponse> {
  const product = await prisma.product.findFirst({
    where: { id, restaurantId: ctx.restaurantId, deletedAt: null },
  });
  if (!product) return apiError(404, "not_found", "Product not found");
  return ok({ data: serializeProduct(product) });
}

// --- Categories ------------------------------------------------------------
export async function listCategories(ctx: ApiContext): Promise<ApiResponse> {
  const rows = await prisma.category.findMany({
    where: { restaurantId: ctx.restaurantId },
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return ok({ data: rows.map(serializeCategory) });
}

// --- Orders ----------------------------------------------------------------
export async function listOrders(ctx: ApiContext, q: ListQuery = {}): Promise<ApiResponse> {
  const { page, perPage, skip } = pagination(q);
  const where: Prisma.OrderWhereInput = { restaurantId: ctx.restaurantId };
  if (q.status) where.status = q.status as Prisma.OrderWhereInput["status"];

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: perPage, include: { items: true } }),
  ]);
  return paginated(rows.map(serializeOrder), { page, perPage, total });
}

export async function getOrder(ctx: ApiContext, id: string): Promise<ApiResponse> {
  const order = await prisma.order.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    include: { items: true },
  });
  if (!order) return apiError(404, "not_found", "Order not found");
  return ok({ data: serializeOrder(order) });
}

export async function createOrder(ctx: ApiContext, input: unknown): Promise<ApiResponse> {
  const parsed = apiCreateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return apiError(422, "validation_error", "Invalid request body", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: ctx.restaurantId },
    select: { taxRate: true, deliveryFee: true },
  });
  if (!restaurant) return apiError(404, "not_found", "Restaurant not found");

  const itemResult = await buildOrderItems(ctx.restaurantId, data.items as OrderItemInput[]);
  if (!itemResult.ok) return apiError(422, "invalid_items", itemResult.error);

  const taxAmount = round2((itemResult.subtotal * Number(restaurant.taxRate)) / 100);
  const deliveryFee = data.type === "DELIVERY" ? Number(restaurant.deliveryFee) : 0;
  const totals = computeTotals(itemResult.subtotal, 0, taxAmount, deliveryFee);

  const orderNumber = await nextOrderNumber(ctx.restaurantId);
  const order = await prisma.order.create({
    data: {
      restaurantId: ctx.restaurantId,
      orderNumber,
      type: data.type,
      status: "PENDING",
      customerName: data.customer.name,
      customerPhone: data.customer.phone,
      customerEmail: data.customer.email || null,
      address: data.customer.address || null,
      paymentMethod: data.paymentMethod,
      paymentStatus: "UNPAID",
      subtotal: new Prisma.Decimal(totals.subtotal),
      discountAmount: new Prisma.Decimal(totals.discountAmount),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      deliveryFee: new Prisma.Decimal(totals.deliveryFee),
      total: new Prisma.Decimal(totals.total),
      notes: data.notes || null,
      items: {
        create: itemResult.built.map((b) => ({
          productId: b.productId,
          nameSnapshot: b.nameSnapshot,
          unitPrice: new Prisma.Decimal(b.unitPrice),
          quantity: b.quantity,
          lineTotal: new Prisma.Decimal(b.lineTotal),
          options: b.options as unknown as Prisma.InputJsonValue,
        })),
      },
      events: { create: { status: "PENDING", note: "Order created via API" } },
    },
    include: { items: true },
  });

  return created({ data: serializeOrder(order) });
}

// --- Customers -------------------------------------------------------------
export async function listCustomers(ctx: ApiContext, q: ListQuery = {}): Promise<ApiResponse> {
  const { page, perPage, skip } = pagination(q);
  const where: Prisma.CustomerWhereInput = { restaurantId: ctx.restaurantId };
  if (q.search?.trim()) {
    const s = q.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { phone: { contains: s } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: perPage,
      include: { _count: { select: { orders: true } } },
    }),
  ]);
  return paginated(rows.map(serializeCustomer), { page, perPage, total });
}
