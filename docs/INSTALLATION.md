# Installation Guide

Get RestoPanel running locally for development. For production hosting see
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | ships with `npm` |
| PostgreSQL | 14+ | local, Docker, or a cloud instance (Neon) |
| Git | any | to clone the repo |

> **Native modules:** RestoPanel deliberately avoids anything requiring
> `node-gyp` (passwords use `bcryptjs`, not `bcrypt`). A plain `npm install`
> works on any platform, including sandboxes that can't compile native code.

## 1. Clone & install

```bash
git clone <your-repo-url> restopanel
cd restopanel
npm install          # runs `prisma generate` automatically (postinstall)
```

## 2. Environment variables

```bash
cp .env.example .env
```

Fill in at minimum:

- `DATABASE_URL` — your Postgres connection string.
- `AUTH_SECRET` — generate one: `npx auth secret` (or `openssl rand -base64 33`).
- `AUTH_URL` — `http://localhost:3000` for local dev.

Everything else (Cloudinary, Resend, Stripe, Twilio, push) is optional locally —
those integrations **degrade gracefully**: when unconfigured, uploads fall back to
local storage and emails/SMS/push are logged-and-skipped rather than erroring. See
`.env.example` for the full annotated list.

## 3. Database

**Option A — Docker Postgres (recommended):**

```bash
docker compose up -d        # starts Postgres on localhost:5432
```

The default `DATABASE_URL` in `.env.example` matches this container.

**Option B — your own Postgres:** create a database and set `DATABASE_URL`.

Then sync the schema and seed the platform admin:

```bash
npm run db:push             # apply prisma/schema.prisma to the database
npm run db:seed:admin       # create the super-admin (uses ADMIN_* env vars)
```

> RestoPanel evolves its schema with **`prisma db push`**, not migrations. Run
> `npm run db:push` again after pulling schema changes. (`npm run db:seed` also
> loads demo data if you want a populated dev environment.)

## 4. Run

```bash
npm run dev                 # http://localhost:3000
```

- Marketing site: `http://localhost:3000`
- Register a restaurant: `/register` → lands on `/dashboard`
- A restaurant's storefront: `/r/<slug>`
- Customer account: `/account`
- Super admin: `/admin`

## 5. Verify the install

```bash
npm run build               # prisma generate && next build — must exit 0
npm test                    # full end-to-end suite against the database
curl http://localhost:3000/api/health   # {"status":"ok", ...}
```

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Run every `scripts/test-*.ts` suite |
| `npm run db:push` | Sync schema to the database |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:seed` | Seed demo data |
| `npm run db:seed:admin` | Seed the super-admin account |
| `npm run db:backup` | Dump the database (see `scripts/backup-db.ts`) |

## Troubleshooting

- **`Can't reach database server`** — is Postgres up (`docker compose ps`) and
  `DATABASE_URL` correct?
- **Prisma `EPERM` on Windows during generate** — stop the dev server first; it
  holds the query-engine DLL. Then re-run `npx prisma generate`.
- **Auth errors / redirect loops** — ensure `AUTH_SECRET` is set and `AUTH_URL`
  matches the origin you're browsing.
- **Schema out of date after a pull** — run `npm run db:push`.
