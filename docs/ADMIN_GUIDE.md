# Super Admin Guide

The **platform operator** area lives at `/admin` and is completely isolated from
tenant data. Admins sign in with an `AdminUser` account (separate from restaurant
`User`s and `CustomerAccount`s) secured by an HMAC-signed session. Super admins
manage every restaurant on the platform, billing, content, and support — but
never see a tenant's day-to-day operational data beyond what moderation requires.

## Signing in

1. Go to `/admin/login`.
2. Enter your admin email + password (seeded via `npm run db:seed:admin`, which
   reads `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD`).
3. Sessions are short-lived signed tokens; sign out from the top bar.

To create the first admin: set the `ADMIN_*` env vars and run
`npm run db:seed:admin`.

## Dashboard (`/admin`)

Platform overview with headline metrics and deltas versus the previous period:

- Total / active / suspended restaurants
- Total users, active subscriptions, trials
- **MRR / ARR**, monthly and total revenue (paid invoices only)
- New signups, expiring subscriptions, churn
- Revenue and growth series (12-month charts)

## Restaurants (`/admin/restaurants`)

Moderate every tenant on the platform.

- **Search & filter** by name/slug and status (Active / Suspended).
- **Open a restaurant** to see its profile, owner, plan, and usage.
- **Suspend** a restaurant with a reason — its storefront and dashboard are
  blocked until reactivated. **Activate** restores access and clears the reason.
- Soft-deleted restaurants are hidden from listings.

## Users (`/admin/users`)

Read-only directory of restaurant `User`s (owners/managers/staff) across all
tenants, for support and abuse investigations.

## Subscriptions (`/admin/subscriptions`)

- One subscription per restaurant; upserting replaces the existing one.
- Change plan/status; yearly prices are snapshotted at the time of change.
- Setting status to `CANCELED` stamps `canceledAt`.

## Billing (`/admin/billing`)

- Browse invoices platform-wide (newest first), each with a unique number.
- Invoice recording is idempotent on `stripeInvoiceId` (no duplicates from
  webhook retries).
- Revenue totals count **paid** invoices only; `OPEN` invoices are excluded.

## Analytics (`/admin/analytics`)

Deeper platform analytics — revenue/growth series, churn, and cohort views built
on the same metrics as the dashboard.

## CMS (`/admin/cms`)

Manage public marketing content rendered on the landing site:

- **FAQ items**, **blog posts** (draft/published; publishing stamps `publishedAt`),
  and structured **CMS pages** (content stored as JSON, upserted by key).

## Support (`/admin/support`)

- Tickets raised by restaurant owners. A new ticket is `OPEN` with the owner's
  first message.
- **Reply** as an admin — this appends an `ADMIN` message and moves the ticket to
  `PENDING`.
- Set status to `RESOLVED` when handled. Search tickets by subject/content.

## Settings (`/admin/settings`)

Platform-wide **provider configuration** (stored in the `PlatformSettings`
singleton, with env-var fallbacks). This is where the integrations for the whole
platform are switched on:

- **Resend** (email): API key, from-name/email, enabled toggle.
- **Twilio** (SMS): SID, auth token, from-number.
- **Stripe** (payments/billing): secret, publishable, webhook keys.
- **Cloudinary** (uploads): cloud name, key, secret.

> Each provider returns "not configured → skip" when disabled, so the platform
> keeps working (emails/SMS logged, uploads local) until you fill these in. Env
> vars take precedence and are the recommended way to hold secrets in production.

## Security model (what keeps admin isolated)

- `AdminUser` is a separate table from tenant `User` and `CustomerAccount`.
- Admin sessions are HMAC-signed and verified on every `/admin` request; tampered,
  expired, empty, or garbage tokens are rejected.
- Admins operate on platform models only; tenant row-level scoping still applies
  to all tenant queries elsewhere.
