import type {
  Category,
  Customer,
  Order,
  OrderItem,
  Product,
  Restaurant,
} from "@prisma/client";

/**
 * Convert internal Prisma records into stable public JSON for the REST API.
 * Decimals become numbers, dates become ISO strings, and internal-only fields
 * (cost price, internal notes, password hashes, etc.) are never exposed.
 */

const num = (v: unknown): number => Number(v ?? 0);
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function serializeRestaurant(r: Restaurant) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    email: r.email,
    phone: r.phone,
    website: r.website,
    address: r.address,
    city: r.city,
    country: r.country,
    currency: r.currency,
    currencySymbol: r.currencySymbol,
    timezone: r.timezone,
    deliveryEnabled: r.deliveryEnabled,
    pickupEnabled: r.pickupEnabled,
    dineInEnabled: r.dineInEnabled,
    minimumOrder: num(r.minimumOrder),
    deliveryFee: num(r.deliveryFee),
    taxRate: num(r.taxRate),
    openingHours: r.openingHours ?? null,
    createdAt: iso(r.createdAt),
  };
}

export function serializeCategory(c: Category & { _count?: { products: number } }) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    position: c.position,
    isActive: c.isActive,
    productCount: c._count?.products,
  };
}

export function serializeProduct(p: Product) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    shortDescription: p.shortDescription,
    categoryId: p.categoryId,
    price: num(p.price),
    comparePrice: p.comparePrice != null ? num(p.comparePrice) : null,
    discount: num(p.discount),
    images: (p.images as unknown as { url: string }[] | null) ?? [],
    calories: p.calories,
    prepTimeMins: p.prepTimeMins,
    ingredients: p.ingredients,
    status: p.status,
    isAvailable: p.isAvailable,
    featured: p.featured,
    bestSeller: p.bestSeller,
    stockStatus: p.stockStatus,
    createdAt: iso(p.createdAt),
  };
}

export function serializeOrder(o: Order & { items?: OrderItem[] }) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    type: o.type,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    address: o.address,
    subtotal: num(o.subtotal),
    discountAmount: num(o.discountAmount),
    taxAmount: num(o.taxAmount),
    deliveryFee: num(o.deliveryFee),
    total: num(o.total),
    couponCode: o.couponCode,
    notes: o.notes,
    items: (o.items ?? []).map((i) => ({
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: num(i.unitPrice),
      lineTotal: num(i.lineTotal),
      options: i.options ?? null,
    })),
    createdAt: iso(o.createdAt),
  };
}

export function serializeCustomer(c: Customer & { _count?: { orders: number } }) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    status: c.status,
    tags: c.tags,
    totalOrders: c._count?.orders,
    createdAt: iso(c.createdAt),
  };
}
