import { prisma } from "@/lib/prisma";

/**
 * Minimal, dependency-free Stripe client.
 *
 * Stripe's REST API is plain HTTPS + form-encoding, so we talk to it with
 * `fetch` rather than the SDK — no native modules, no extra dependency, and the
 * webhook signature is verified with Web Crypto (same approach as the admin
 * session). Credentials come from PlatformSettings (admin-editable) and fall
 * back to env vars.
 *
 * The whole module degrades gracefully: when Stripe is not configured,
 * `getStripeConfig()` returns null and callers fall back to the manual billing
 * flow in lib/billing/subscription.ts.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string | null;
  publishableKey: string | null;
}

export async function getStripeConfig(): Promise<StripeConfig | null> {
  // Prefer admin-managed settings; fall back to environment.
  let secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  let publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

  const settings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { stripe: true },
  });
  const blob = (settings?.stripe ?? {}) as {
    enabled?: boolean;
    secretKey?: string;
    webhookSecret?: string;
    publishableKey?: string;
  };
  if (blob.enabled === false && !process.env.STRIPE_SECRET_KEY) return null;
  if (blob.secretKey) secretKey = blob.secretKey;
  if (blob.webhookSecret) webhookSecret = blob.webhookSecret;
  if (blob.publishableKey) publishableKey = blob.publishableKey;

  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: webhookSecret || null,
    publishableKey: publishableKey || null,
  };
}

export async function isStripeEnabled(): Promise<boolean> {
  return (await getStripeConfig()) !== null;
}

// --- Form encoding (supports nested keys: a[b]=c) --------------------------
function encodeForm(
  params: Record<string, unknown>,
  prefix = ""
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(encodeForm(value as Record<string, unknown>, k));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v != null && typeof v === "object") {
          parts.push(encodeForm(v as Record<string, unknown>, `${k}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${k}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export class StripeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "StripeError";
  }
}

/** Low-level call to the Stripe API. */
export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  config?: StripeConfig
): Promise<T> {
  const cfg = config ?? (await getStripeConfig());
  if (!cfg) throw new StripeError("Stripe is not configured", 400);

  const url = `https://api.stripe.com/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? encodeForm(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error ?? {}) as { message?: string };
    throw new StripeError(err.message ?? `Stripe request failed (${res.status})`, res.status);
  }
  return json as T;
}

// --- High-level helpers ----------------------------------------------------

/** Ensure a Stripe customer exists for the restaurant and return its id. */
export async function ensureStripeCustomer(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { id: true, name: true, email: true, subscription: { select: { id: true, stripeCustomerId: true } } },
  });
  if (restaurant.subscription?.stripeCustomerId) {
    return restaurant.subscription.stripeCustomerId;
  }

  const customer = await stripeRequest<{ id: string }>("POST", "customers", {
    name: restaurant.name,
    email: restaurant.email ?? undefined,
    metadata: { restaurantId },
  });

  if (restaurant.subscription) {
    await prisma.subscription.update({
      where: { id: restaurant.subscription.id },
      data: { stripeCustomerId: customer.id },
    });
  }
  return customer.id;
}

/** Create a Checkout Session (subscription mode) and return its hosted URL. */
export async function createCheckoutSession(input: {
  restaurantId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<{ id: string; url: string }> {
  const customerId = await ensureStripeCustomer(input.restaurantId);
  const session = await stripeRequest<{ id: string; url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: input.trialDays ? { trial_period_days: input.trialDays } : undefined,
    metadata: { restaurantId: input.restaurantId },
  });
  return { id: session.id, url: session.url };
}

/** Create a Billing Portal session so the tenant can self-manage their card/plan. */
export async function createBillingPortalSession(
  restaurantId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const customerId = await ensureStripeCustomer(restaurantId);
  const session = await stripeRequest<{ url: string }>("POST", "billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

// --- Webhook signature verification (Web Crypto, edge-safe) ----------------
const encoder = new TextEncoder();

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header) over the raw
 * body. Mirrors Stripe's scheme: HMAC-SHA256 of `${t}.${payload}` compared to a
 * `v1` signature, with a tolerance window on the timestamp.
 */
export async function verifyStripeSignature(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}): Promise<boolean> {
  const { payload, signatureHeader, secret } = input;
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSec - Number(t)) > tolerance) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${t}.${payload}`));
  return timingSafeEqualHex(toHex(sig), v1);
}

/** Build the value a `Stripe-Signature` header would carry (used in tests). */
export async function signStripePayload(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return `t=${timestamp},v1=${toHex(sig)}`;
}
