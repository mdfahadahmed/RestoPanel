import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import type {
  AddressInput,
  ChangePasswordInput,
  CustomerRegisterInput,
  OrderListQuery,
  UpdateProfileInput,
  UpdateSettingsInput,
} from "@/lib/validations/account";
import type { OrderStatus, Prisma } from "@prisma/client";

const ORDERS_PER_PAGE = 8;

// Buckets used by the dashboard summary cards.
const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
];
const COMPLETED_STATUSES: OrderStatus[] = ["DELIVERED"];
const CANCELLED_STATUSES: OrderStatus[] = ["CANCELLED", "REJECTED", "REFUNDED"];

/** The set of Customer rows an account owns (for order relation filters). */
function ownedOrderWhere(accountId: string): Prisma.OrderWhereInput {
  return { customer: { is: { accountId } } };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AccountAuthResult = ActionResult<{
  id: string;
  email: string;
  tokenVersion: number;
}>;

/**
 * Link any per-restaurant Customer profiles that share this email to the
 * account (only rows not already linked). Backfills a new account's order
 * history from prior guest orders placed with the same email.
 */
export async function linkCustomersByEmail(
  accountId: string,
  email: string
): Promise<number> {
  const res = await prisma.customer.updateMany({
    where: { email: { equals: email, mode: "insensitive" }, accountId: null },
    data: { accountId },
  });
  return res.count;
}

export async function registerAccount(
  data: CustomerRegisterInput
): Promise<AccountAuthResult> {
  const existing = await prisma.customerAccount.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return actionError("An account with this email already exists", {
      email: ["That email is already registered"],
    });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const account = await prisma.customerAccount.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash,
      lastLoginAt: new Date(),
    },
    select: { id: true, email: true, tokenVersion: true },
  });

  await linkCustomersByEmail(account.id, account.email);
  return actionOk(account);
}

export async function authenticateAccount(
  email: string,
  password: string
): Promise<AccountAuthResult> {
  const account = await prisma.customerAccount.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, tokenVersion: true },
  });
  if (!account) return actionError("Incorrect email or password");

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) return actionError("Incorrect email or password");

  await prisma.customerAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });
  // Opportunistically link any guest orders placed with this email.
  await linkCustomersByEmail(account.id, account.email);

  return actionOk({
    id: account.id,
    email: account.email,
    tokenVersion: account.tokenVersion,
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardData(accountId: string) {
  const base = ownedOrderWhere(accountId);

  const [total, active, completed, cancelled, recent, loyalty] = await Promise.all([
    prisma.order.count({ where: base }),
    prisma.order.count({ where: { ...base, status: { in: ACTIVE_STATUSES } } }),
    prisma.order.count({ where: { ...base, status: { in: COMPLETED_STATUSES } } }),
    prisma.order.count({ where: { ...base, status: { in: CANCELLED_STATUSES } } }),
    prisma.order.findMany({
      where: base,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        type: true,
        createdAt: true,
        restaurant: { select: { name: true, slug: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.customer.aggregate({
      where: { accountId },
      _sum: { loyaltyPoints: true },
    }),
  ]);

  return {
    total,
    active,
    completed,
    cancelled,
    recent,
    loyaltyPoints: loyalty._sum.loyaltyPoints ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function listOrders(accountId: string, query: OrderListQuery) {
  const where: Prisma.OrderWhereInput = { ...ownedOrderWhere(accountId) };

  if (query.status && query.status !== "ALL") {
    where.status = query.status as OrderStatus;
  }
  if (query.restaurantId && query.restaurantId !== "ALL") {
    where.restaurantId = query.restaurantId;
  }
  if (query.q) {
    where.OR = [
      { orderNumber: { contains: query.q, mode: "insensitive" } },
      { restaurant: { is: { name: { contains: query.q, mode: "insensitive" } } } },
      { items: { some: { nameSnapshot: { contains: query.q, mode: "insensitive" } } } },
    ];
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    query.sort === "date_asc"
      ? { createdAt: "asc" }
      : query.sort === "total_desc"
        ? { total: "desc" }
        : query.sort === "total_asc"
          ? { total: "asc" }
          : { createdAt: "desc" };

  const page = Math.max(1, query.page);
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        type: true,
        total: true,
        createdAt: true,
        restaurant: { select: { name: true, slug: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    orders,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)),
    perPage: ORDERS_PER_PAGE,
  };
}

/** Restaurants this account has ordered from (for the filter dropdown). */
export async function listOrderedRestaurants(accountId: string) {
  const rows = await prisma.order.findMany({
    where: ownedOrderWhere(accountId),
    distinct: ["restaurantId"],
    select: { restaurantId: true, restaurant: { select: { name: true } } },
    orderBy: { restaurant: { name: "asc" } },
  });
  return rows.map((r) => ({ id: r.restaurantId, name: r.restaurant.name }));
}

/** Full order detail — scoped so an account can only read its own orders. */
export async function getOrderForAccount(accountId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...ownedOrderWhere(accountId) },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      review: { select: { id: true, rating: true } },
      restaurant: {
        select: {
          name: true,
          slug: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true,
          currency: true,
          taxName: true,
        },
      },
    },
  });
}

/** Active (in-progress) orders for the tracking page. */
export async function getActiveOrders(accountId: string) {
  return prisma.order.findMany({
    where: { ...ownedOrderWhere(accountId), status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      type: true,
      total: true,
      createdAt: true,
      restaurant: { select: { name: true, slug: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------

export async function updateProfile(
  accountId: string,
  data: UpdateProfileInput
): Promise<ActionResult> {
  // Enforce a globally-unique email.
  const clash = await prisma.customerAccount.findFirst({
    where: { email: data.email, NOT: { id: accountId } },
    select: { id: true },
  });
  if (clash) {
    return actionError("That email is already in use", {
      email: ["That email is already in use"],
    });
  }

  await prisma.customerAccount.update({
    where: { id: accountId },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      avatarUrl: data.avatarUrl || null,
      avatarKey: data.avatarKey || null,
    },
  });
  // Keep linked customer profiles reachable by the (possibly new) email.
  await linkCustomersByEmail(accountId, data.email);
  return actionOk();
}

/**
 * Change the password. On success the account's tokenVersion is bumped so all
 * other sessions are invalidated; the returned version lets the caller re-issue
 * the current session's cookie.
 */
export async function changePassword(
  accountId: string,
  data: ChangePasswordInput
): Promise<ActionResult<{ tokenVersion: number }>> {
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { passwordHash: true },
  });
  if (!account) return actionError("Account not found");

  const valid = await bcrypt.compare(data.currentPassword, account.passwordHash);
  if (!valid) {
    return actionError("Your current password is incorrect", {
      currentPassword: ["Incorrect password"],
    });
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  const updated = await prisma.customerAccount.update({
    where: { id: accountId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return actionOk({ tokenVersion: updated.tokenVersion });
}

export async function updateSettings(
  accountId: string,
  data: UpdateSettingsInput
): Promise<ActionResult> {
  await prisma.customerAccount.update({
    where: { id: accountId },
    data: {
      language: data.language,
      theme: data.theme,
      notifyOrderUpdates: data.notifyOrderUpdates,
      notifyPromotions: data.notifyPromotions,
      notifyRestaurantMsgs: data.notifyRestaurantMsgs,
    },
  });
  return actionOk();
}

export async function getAccountSettings(accountId: string) {
  return prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      avatarKey: true,
      language: true,
      theme: true,
      notifyOrderUpdates: true,
      notifyPromotions: true,
      notifyRestaurantMsgs: true,
      createdAt: true,
    },
  });
}

/** Bump tokenVersion — invalidates every issued session ("sign out everywhere"). */
export async function bumpTokenVersion(accountId: string): Promise<number> {
  const updated = await prisma.customerAccount.update({
    where: { id: accountId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return updated.tokenVersion;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export function listAddresses(accountId: string) {
  return prisma.customerAddress.findMany({
    where: { accountId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function addAddress(
  accountId: string,
  data: AddressInput
): Promise<ActionResult> {
  const count = await prisma.customerAddress.count({ where: { accountId } });
  const makeDefault = data.isDefault || count === 0;

  await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.customerAddress.updateMany({
        where: { accountId },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.create({
      data: {
        accountId,
        label: data.label,
        fullName: data.fullName || null,
        phone: data.phone || null,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || null,
        notes: data.notes || null,
        isDefault: makeDefault,
      },
    });
  });
  return actionOk();
}

export async function updateAddress(
  accountId: string,
  addressId: string,
  data: AddressInput
): Promise<ActionResult> {
  const owned = await prisma.customerAddress.findFirst({
    where: { id: addressId, accountId },
    select: { id: true },
  });
  if (!owned) return actionError("Address not found");

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { accountId, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.update({
      where: { id: addressId },
      data: {
        label: data.label,
        fullName: data.fullName || null,
        phone: data.phone || null,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || null,
        notes: data.notes || null,
        isDefault: data.isDefault,
      },
    });
  });
  return actionOk();
}

export async function deleteAddress(
  accountId: string,
  addressId: string
): Promise<ActionResult> {
  const address = await prisma.customerAddress.findFirst({
    where: { id: addressId, accountId },
    select: { id: true, isDefault: true },
  });
  if (!address) return actionError("Address not found");

  await prisma.$transaction(async (tx) => {
    await tx.customerAddress.delete({ where: { id: addressId } });
    if (address.isDefault) {
      // Promote the most recent remaining address to default.
      const next = await tx.customerAddress.findFirst({
        where: { accountId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.customerAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });
  return actionOk();
}

export async function setDefaultAddress(
  accountId: string,
  addressId: string
): Promise<ActionResult> {
  const owned = await prisma.customerAddress.findFirst({
    where: { id: addressId, accountId },
    select: { id: true },
  });
  if (!owned) return actionError("Address not found");

  await prisma.$transaction([
    prisma.customerAddress.updateMany({
      where: { accountId },
      data: { isDefault: false },
    }),
    prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);
  return actionOk();
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function listFavorites(accountId: string) {
  const favorites = await prisma.customerFavorite.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          discount: true,
          images: true,
          isAvailable: true,
          status: true,
          deletedAt: true,
          restaurant: { select: { name: true, slug: true, currencySymbol: true } },
        },
      },
    },
  });
  // Drop favorites whose product was hard-deleted defensively (cascade normally
  // removes them, but keep the UI resilient).
  return favorites.filter((f) => f.product && f.product.deletedAt === null);
}

export async function isFavorited(
  accountId: string,
  productId: string
): Promise<boolean> {
  const row = await prisma.customerFavorite.findUnique({
    where: { accountId_productId: { accountId, productId } },
    select: { id: true },
  });
  return row !== null;
}

export async function addFavorite(
  accountId: string,
  productId: string
): Promise<ActionResult> {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, restaurantId: true },
  });
  if (!product) return actionError("Product not found");

  await prisma.customerFavorite.upsert({
    where: { accountId_productId: { accountId, productId } },
    update: {},
    create: { accountId, productId, restaurantId: product.restaurantId },
  });
  return actionOk();
}

export async function removeFavorite(
  accountId: string,
  productId: string
): Promise<ActionResult> {
  await prisma.customerFavorite.deleteMany({ where: { accountId, productId } });
  return actionOk();
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function listNotifications(accountId: string) {
  return prisma.customerNotification.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function unreadNotificationCount(accountId: string) {
  return prisma.customerNotification.count({
    where: { accountId, isRead: false },
  });
}

export async function markNotificationRead(
  accountId: string,
  notificationId: string
): Promise<ActionResult> {
  await prisma.customerNotification.updateMany({
    where: { id: notificationId, accountId },
    data: { isRead: true },
  });
  return actionOk();
}

export async function markAllNotificationsRead(
  accountId: string
): Promise<ActionResult> {
  await prisma.customerNotification.updateMany({
    where: { accountId, isRead: false },
    data: { isRead: true },
  });
  return actionOk();
}

export async function deleteNotification(
  accountId: string,
  notificationId: string
): Promise<ActionResult> {
  await prisma.customerNotification.deleteMany({
    where: { id: notificationId, accountId },
  });
  return actionOk();
}
