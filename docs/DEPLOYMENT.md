# Deploying RestoPanel

Production stack: **Vercel** (hosting + SSL + cron) · **Neon** (PostgreSQL) ·
**Cloudinary** (image uploads) · **Resend** (email) · **Stripe** (payments).

> These steps need your own accounts and API keys. Commands marked **(interactive)**
> open a browser or prompt for login — run them yourself in a terminal (in Claude
> Code you can prefix a line with `!` to run it in-session). Never commit secrets;
> all keys live in Vercel environment variables, not in the repo.

---

## 0. Pre-flight (already green in this repo)

```bash
npm run build        # prisma generate && next build  → must exit 0
npm test             # 24 suites, 0 failures
```

The build command runs `prisma generate` automatically. It does **not** touch the
database — schema sync is a separate step (§2).

---

## 1. Neon PostgreSQL

1. Create a project at https://neon.tech (pick a region near `lhr1`/London to match
   `vercel.json`, e.g. AWS `eu-west-2`).
2. Copy the **pooled** connection string (host contains `-pooler`). It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.eu-west-2.aws.neon.tech/DB?sslmode=require
   ```
   `sslmode=require` gives you DB-level SSL out of the box.
3. Keep the **direct** (non-pooled) string too — handy for the one-off schema push.

## 2. Sync the schema to Neon  ⚠️ important

This project evolves its schema with **`prisma db push`**, not migrations — the
`prisma/migrations/` folder is intentionally partial, so `prisma migrate deploy`
would create an **incomplete** database. Push the full schema once against Neon:

```bash
# (interactive-ish) run locally with the Neon URL, then seed the platform admin
DATABASE_URL="postgresql://…-pooler…/DB?sslmode=require" npx prisma db push
DATABASE_URL="postgresql://…-pooler…/DB?sslmode=require" npm run db:seed:admin
```

Re-run `prisma db push` after any future `schema.prisma` change.

## 3. Cloudinary (image uploads)

1. Sign up at https://cloudinary.com → Dashboard shows **Cloud name**, **API Key**,
   **API Secret**.
2. Env vars (§6): `UPLOAD_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

`next.config.mjs` already allows remote HTTPS images, so Cloudinary URLs render
through Next's image optimizer with no extra config.

## 4. Resend (email)

1. Sign up at https://resend.com → **API Keys** → create one (`re_…`).
2. **Verify your sending domain** (Domains → add DNS records). Until verified you
   can only send to your own address.
3. Env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL="orders@yourdomain.com"` (must be
   on the verified domain).

Email degrades gracefully: if unset, password-reset/notification sends are skipped
(logged), not errored — so the app still deploys and runs without email configured.

## 5. Stripe (payments)

1. https://dashboard.stripe.com → **Developers → API keys**: copy the **Secret key**
   (`sk_live_…`) and **Publishable key** (`pk_live_…`).
2. **Developers → Webhooks → Add endpoint** *after* the first deploy (you need the
   URL): `https://YOUR-DOMAIN/api/stripe/webhook`. Subscribe to at least
   `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, and the `customer.subscription.*` /
   `invoice.*` events (billing). Copy the **Signing secret** (`whsec_…`).
3. Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
   Leave `PAYMENTS_MODE` **unset** for real Stripe; set `PAYMENTS_MODE=mock` only for
   demos/CI (forces the deterministic mock gateway).

## 6. Environment variables (set in Vercel → Project → Settings → Environment Variables)

**Required**

| Variable | Value / source |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (§1) |
| `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 33` |
| `AUTH_URL` | `https://YOUR-DOMAIN` (your Vercel/custom domain) |
| `NEXT_PUBLIC_APP_URL` | same as `AUTH_URL` (used for absolute links/metadata) |
| `CRON_SECRET` | long random string; guards `/api/cron/*` (required in prod) |

**Cloudinary** — `UPLOAD_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**Resend** — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

**Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

**Optional** — `SENTRY_DSN`, `ERROR_WEBHOOK_URL`, `LOG_LEVEL`, `APP_HOST`,
`BACKUP_WEBHOOK_URL`, `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`
(SMS), `PUSH_PROVIDER` / `EXPO_ACCESS_TOKEN` (mobile push).

> `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `CRON_SECRET` must be set for **Production**
> (and Preview if you use it). After changing env vars, redeploy for them to apply.

## 7. Deploy to Vercel

```bash
npm i -g vercel          # if not installed
vercel login             # (interactive)
vercel link              # (interactive) link this folder to a Vercel project
# set env vars in the dashboard (§6), or: vercel env add DATABASE_URL production
vercel --prod            # build + deploy
```

Or connect the Git repo in the Vercel dashboard for push-to-deploy. Vercel
auto-detects Next.js; the build command (`prisma generate && next build`) comes from
`package.json`. `vercel.json` already configures the `lhr1` region, security headers,
and the two cron jobs (daily DB backup 03:00, hourly subscription renewals).

## 8. SSL / TLS

Automatic. Vercel provisions and renews TLS certificates for every `*.vercel.app`
and custom domain — no action needed. HSTS is already enforced via `vercel.json`
(`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`). Neon
connections use `sslmode=require`. To add a custom domain: Vercel → Project →
Domains → add it and follow the DNS instructions; then update `AUTH_URL`,
`NEXT_PUBLIC_APP_URL`, `APP_HOST`, and the Stripe webhook URL to match.

## 9. Post-deploy verification

```bash
curl -s https://YOUR-DOMAIN/api/health          # {"status":"ok", db check passes}
```

- Register an owner → confirm the dashboard loads and a workspace/slug is created.
- Open the storefront `/r/<slug>`, add to cart, and place a **cash** order → track it.
- With Stripe live, place an **online** order and confirm the webhook marks it paid
  (Stripe Dashboard → Webhooks → recent deliveries should be `200`).
- Trigger a password reset and confirm the Resend email arrives.
- Upload a product image and confirm it lands on Cloudinary.
- Cron: check Vercel → Deployments → Cron for successful `/api/cron/*` runs.
