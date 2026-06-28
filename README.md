# RestoPanel

A cloud, multi-tenant **restaurant management SaaS**. Owners register and get a
dedicated admin dashboard plus a branded customer ordering site. Built with
Next.js 15, React 19, TypeScript, Tailwind CSS v4, Prisma + PostgreSQL, Auth.js,
GSAP and Framer Motion.

> **Engineering guide:** see [`CLAUDE.md`](./CLAUDE.md) for the full architecture,
> conventions, and roadmap.

## Phase 1 (built)
- Premium black-theme marketing landing page (hero, features, dashboard preview,
  pricing, testimonials, FAQ, contact) with GSAP + Framer Motion animations.
- Registration that auto-provisions a restaurant workspace + owner account.
- Login via Auth.js (Credentials, JWT) with multi-tenant session context.
- Protected dashboard shell scoped to the signed-in restaurant.

## Quick start

```bash
# 1. Configure environment
cp .env.example .env
#    - set DATABASE_URL (local Postgres or a free Neon DB)
#    - set AUTH_SECRET   (npx auth secret)

# 2. (optional) local Postgres
docker compose up -d

# 3. Install + migrate + run
npm install
npm run db:migrate      # creates tables
npm run db:seed         # optional demo data (demo@restopanel.com / demo12345)
npm run dev             # http://localhost:3000
```

No Postgres handy? Use a free [Neon](https://neon.tech) database and paste its
connection string into `DATABASE_URL`.

## Scripts
- `npm run dev` — dev server
- `npm run build` — `prisma generate` + production build
- `npm run db:migrate` / `db:push` / `db:studio` / `db:seed`

## Project structure
See the **Folder structure** section in [`CLAUDE.md`](./CLAUDE.md).

## Roadmap
Phase 2: dashboard CRUD + customer ordering site · Phase 3: analytics, SMS,
order tracking · Phase 4: multi-tenant hardening, security, deployment.
