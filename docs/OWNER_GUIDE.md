# Restaurant Owner Guide

Everything a restaurant owner or operator does happens in the **Dashboard** at
`/dashboard`. Registering a restaurant instantly provisions your workspace: an
admin dashboard **and** a branded customer ordering site at `/r/<your-slug>`.

## Getting started

1. **Register** at `/register` — restaurant name, your name, email, password. This
   creates your workspace, an `OWNER` account, a unique storefront slug, and puts
   you on the Free plan.
2. You're signed in and redirected to `/dashboard`.
3. **Verify your email** from the link we send (secures your account; non-blocking).
4. Set up your restaurant in **Settings**, then add **Categories** and **Products**
   — your storefront goes live at `/r/<slug>` immediately.

Roles: **OWNER**, **MANAGER**, **STAFF**. Owners have full access; managers/staff
are scoped by role.

## Menu

### Categories (`/dashboard/categories`)
Create and order the sections of your menu. Drag position controls display order;
toggle active to show/hide a whole category on the storefront.

### Products (`/dashboard/products`)
Full product CRUD:

- Price and optional **discount** (stored as `Decimal` — money is never a float).
- **Images** (multi-image gallery via the upload service — local or Cloudinary).
- **Variants** (e.g. sizes with price adjustments) and **extras** (add-ons).
- Flags: **Available**, **Featured**, **Best seller**; prep time, calories,
  ingredients.
- Filter/sort/search; soft-delete with restore.

## Orders (`/dashboard/orders`)

- Live list with filters (status, type, payment) and search.
- **Create orders** manually (`/dashboard/orders/new`) for phone/walk-in.
- Advance an order through its lifecycle: `PENDING → CONFIRMED → PREPARING →
  READY → OUT_FOR_DELIVERY → DELIVERED` (or `CANCELLED/REJECTED/REFUNDED`). Each
  change is timestamped on the order timeline and (if the customer has an account)
  pushes a notification to them.
- Print kitchen tickets / receipts.
- **Order analytics** (`/dashboard/orders/analytics`) — volumes, values, trends.

## Customers (`/dashboard/customers`)

- CRM directory, tenant-scoped and unique by phone.
- Profiles with order history, membership/loyalty, status, and **notes**.
- Filter, search, and **export** to CSV.

## Reservations (`/dashboard/reservations`)

- Table-booking inbox from the storefront reservation form.
- **Tables** (`/dashboard/reservations/tables`) — define your floor plan.
- **Settings** (`/dashboard/reservations/settings`) — service windows, slot
  length, party sizes; availability is computed from these.

## Marketing & engagement

- **Coupons** (`/dashboard/coupons`) — percentage/fixed discounts, date windows,
  usage limits, minimum order. Validated server-side at checkout (usage limits are
  enforced atomically, so a nearly-exhausted coupon can't be over-redeemed).
- **Reviews** (`/dashboard/reviews`) — moderate customer reviews (tied to
  delivered orders); publish/unpublish; they surface on your storefront.
- **Loyalty** (`/dashboard/loyalty`) — points program and transactions.
- **QR codes** (`/dashboard/qr`) — generate table/menu QR codes that deep-link
  into your storefront.

## Operations

- **POS** (`/dashboard/pos`) — in-store point of sale with cash-drawer sessions.
- **KDS / Kitchen** — live kitchen order display.
- **Staff** (`/dashboard/staff`) — team members, shifts, attendance/clock-in.
- **Inventory** (`/dashboard/inventory`) — stock tracking.

## Analytics (`/dashboard/analytics`)

Revenue (paid orders), order counts, average order value, new vs returning
customers, best sellers, category sales, and daily/weekly/monthly series — all
strictly scoped to your restaurant.

## Notifications (`/dashboard/notifications`)

Configure customer-facing messages (email/SMS) for order events, edit templates,
and send test messages. Delivery uses the platform's Resend/Twilio config.

## Settings (`/dashboard/settings`)

Your storefront's identity and rules:

- Branding: logo, cover image, description, social links, SEO meta.
- Contact: address, phone, email; opening hours.
- Ordering: enable **Delivery / Pickup / Dine-in**, delivery fee, minimum order,
  tax rate/name, **currency** (drives all storefront prices), temporary closure.
- Payments: enable **cash on delivery** and/or **online payments**.
- Custom domain (attach a verified hostname that serves your storefront).

## Security (`/dashboard/security`)

- **Two-factor authentication (2FA)** — TOTP authenticator apps + single-use
  backup recovery codes.
- **Passkeys** (WebAuthn) for passwordless sign-in.
- **Active sessions** — "sign out everywhere" invalidates all issued sessions.
- **Login history** — every sign-in attempt (success/failure) with IP and device.
- **Audit log** — an append-only trail of security-relevant actions.

## Billing (`/dashboard/billing`)

- View your plan, usage, and entitlements; upgrade/downgrade (downgrades apply at
  period end), cancel/resume. Paid plans check out via Stripe.
- Feature gates and usage limits follow your plan (e.g. product limits, coupons,
  analytics availability).

## Developer API (`/dashboard/api`)

Create scoped **API keys** (`rp_live_…`) to integrate RestoPanel with your own
systems. See [`API.md`](./API.md) for the full reference.
