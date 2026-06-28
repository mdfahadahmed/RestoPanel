# CLAUDE.md — RestoPanel

> The primary engineering guide for RestoPanel. Read this before writing code.
> It defines the vision, architecture, conventions, and roadmap so every
> contribution stays consistent, secure, and production-ready.

---

## 1. Project vision

RestoPanel is a **cloud, multi-tenant restaurant management SaaS**. A restaurant
owner registers, and the platform instantly provisions a dedicated workspace: an
admin dashboard plus a branded customer-facing ordering site. Owners manage
menus, orders, customers, analytics, and SMS notifications from one elegant,
black-themed interface.

**Audience:** restaurant owners and operators in the **UK, US, and Canada**.
**Brand feel:** premium, minimal, luxury, modern SaaS.

### Goals
- One-click onboarding: register → workspace + dashboard + ordering site auto-created.
- Hard tenant isolation: a restaurant can never see another's data.
- Beautiful, fast, mobile-first UI.
- API-first, scalable backend that supports unlimited restaurants.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 15** (App Router) + React 19 |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` tokens in `globals.css`) |
| Animation | **GSAP** (hero, counters, parallax) + **Framer Motion** (reveals, accordions) |
| Auth | **Auth.js (NextAuth v5)** — Credentials provider, JWT sessions |
| Passwords | **bcryptjs** (pure JS — this environment can't compile native modules) |
| ORM / DB | **Prisma** + **PostgreSQL** |
| Validation | **Zod** (shared client + server schemas) |

> Native-module note: never add deps that require node-gyp compilation
> (e.g. `bcrypt`, `better-sqlite3`). Use pure-JS equivalents.

---

## 3. Folder structure

```
src/
  app/
    (auth)/                 # route group: login, register (shared centered layout)
    api/
      auth/[...nextauth]/   # Auth.js handlers
      register/             # POST: create restaurant + owner
      contact/              # POST: landing contact form
    dashboard/              # protected tenant area (layout calls requireTenant)
      [section]/            # placeholder modules (orders, products, …)
    layout.tsx              # root layout (fonts, metadata)
    page.tsx                # marketing landing page
    globals.css             # Tailwind v4 theme tokens + utilities
  components/
    landing/                # Navbar, Hero, Features, Pricing, FAQ, Contact, …
    auth/                   # AuthField, etc.
    dashboard/              # Sidebar, SignOutButton, …
  lib/
    prisma.ts               # PrismaClient singleton
    tenant.ts               # requireTenant() — tenant context resolver
    slug.ts                 # slugify + unique restaurant slug
    validations/            # Zod schemas
  types/
    next-auth.d.ts          # session/JWT augmentation (restaurantId, role, …)
  auth.config.ts            # edge-safe Auth.js config (used by middleware)
  auth.ts                   # full Auth.js instance (Credentials + Prisma + bcrypt)
  middleware.ts             # route protection
prisma/
  schema.prisma             # multi-tenant data model
```

**Rule:** dashboard feature modules live under `src/app/dashboard/<feature>/` with
co-located server actions and components. Shared UI goes in `src/components/`.

---

## 4. Multi-tenant architecture

- **Model:** single shared Postgres database, **row-level tenancy**. Every
  tenant-owned table carries a `restaurantId` FK to `Restaurant`.
- **The golden rule:** *every* query that reads or writes tenant data MUST be
  filtered by the authenticated `restaurantId`. Never accept a restaurantId from
  the client. Always derive it from the session via `requireTenant()`.
- **Tenant root:** `Restaurant` (has a unique `slug` used for the customer site
  at `/r/<slug>`). Owns users, categories, products, customers, orders.
- **Cascade:** deleting a `Restaurant` cascades to all its data.
- Future scale paths (not needed yet): Postgres RLS policies, per-tenant schemas,
  or DB sharding. Keep all data access behind `lib/` helpers so this can evolve
  without touching feature code.

---

## 5. Authentication flow

1. **Register** (`POST /api/register`): validate (Zod) → ensure email is unique →
   generate unique slug → `bcrypt.hash` password → create `Restaurant` + owner
   `User` (role `OWNER`) in one Prisma call → return ids.
2. Client auto-signs-in via `signIn("credentials")` → redirect to `/dashboard`.
3. **Login** (`/login`): Credentials provider `authorize()` verifies the bcrypt
   hash and returns `{ id, restaurantId, restaurantSlug, restaurantName, role }`.
4. `jwt` callback stamps tenant context onto the token; `session` callback exposes
   it on `session.user`. (Both live in `auth.config.ts`.)
5. **Middleware** runs the edge-safe `authConfig` only (no Prisma/bcrypt) and the
   `authorized` callback gates `/dashboard` and bounces logged-in users off
   `/login` and `/register`.

**Roles:** `OWNER`, `MANAGER`, `STAFF`. Enforce role checks in server actions and
route handlers (helper to be added in Phase 4: `requireRole(...)`).

---

## 6. Database design

See `prisma/schema.prisma`. Core models:

- `Restaurant` — tenant root + settings (logo, cover, address, hours, delivery/
  pickup flags, social links).
- `User` — staff/owner; unique `email`; `passwordHash`; `role`.
- `Category` — `@@unique([restaurantId, slug])`, `position` for ordering.
- `Product` — price/discount as `Decimal(10,2)`; `gallery String[]`; `extras` and
  `variants` as `Json`; `isAvailable`, `prepTimeMins`, `ingredients`.
- `Customer` — `@@unique([restaurantId, phone])`.
- `Order` + `OrderItem` — `OrderStatus` lifecycle enum; `orderNumber` unique per
  restaurant; item price snapshots.

**Migrations:** `npm run db:migrate` (dev). Never edit generated SQL by hand.
**Money:** always `Decimal`, never `Float`. Convert with care at the UI edge.

---

## 7. Coding standards

- TypeScript strict; no `any` unless justified with a comment.
- **Server Components by default.** Add `"use client"` only for interactivity
  (state, effects, browser APIs, GSAP/Framer Motion).
- Validate all external input with Zod at the boundary; reuse schemas on the
  client for instant feedback.
- Data access only through `lib/` (prisma) helpers; keep components thin.
- Prefer `async/await`; handle errors explicitly; never leak internal errors to
  the client.
- Keep functions small and named for intent. Match surrounding style.

### Naming conventions
- Components: `PascalCase` files and exports (`Hero.tsx`).
- Hooks: `useThing`. Helpers/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Routes/slugs/URLs: `kebab-case`. DB columns: as in schema (`camelCase` fields,
  Prisma maps to snake where configured).
- Booleans read as predicates: `isAvailable`, `pickupEnabled`.

---

## 8. State management strategy

- **Server state** lives on the server: fetch in Server Components / route
  handlers via Prisma. Re-fetch with `router.refresh()` after mutations.
- **Local UI state**: `useState`/`useReducer` in client components.
- **Mutations (Phase 2+):** prefer **Server Actions** for dashboard CRUD; return
  typed results and revalidate. Use route handlers for public/customer APIs.
- No global client store unless a real need emerges (then Zustand, scoped small).
- Session is read with `auth()` on the server; avoid client-side session polling.

---

## 9. API structure

- **Internal dashboard mutations:** Server Actions (`"use server"`), tenant-scoped.
- **Public/customer + integrations:** REST route handlers under `app/api/`.
- Conventions: validate with Zod, return `NextResponse.json`, correct status
  codes (`400` validation, `401` auth, `403` role, `404` missing, `409` conflict).
- Customer ordering API (Phase 2/3) is scoped by restaurant `slug`, not session.
- Webhooks (SMS/payments) get their own namespaced routes with signature checks.

### File uploads (storage-provider agnostic)
Uploads go through a single `UploadService` interface (`src/lib/upload/`). The
factory `getUploadService()` selects the implementation from `UPLOAD_PROVIDER`
(`local` by default, `cloudinary` ready). Feature modules never call a provider
directly — they POST/DELETE to `/api/upload` (server) or use `uploadImage()` /
`deleteImage()` and `<ImageUploader>` (client). Assets are namespaced per tenant
via `tenantFolder(restaurantId, kind)`, and deletes are restricted to the
caller's own namespace. Switching providers (local → Cloudinary → S3) is a config
change plus a new class in the registry — no Product-module changes.

---

## 10. UI / UX guidelines

- **Theme:** black-first. Tokens in `globals.css` `@theme`: `ink-*` (surfaces),
  `fog-*` (text), `gold-*` + `violet-*` (accents), `line` (borders).
- **Aesthetic:** glassmorphism (`.glass`), gradient accents (`.text-gradient`,
  `.text-gradient-gold`, `.btn-glow`), soft shadows (`shadow-soft`,
  `shadow-glow`), rounded corners (`rounded-2xl`+), smooth hover transitions.
- **Components:** beautiful cards, elegant tables, dashboard charts. Reuse
  `SectionHeading`, `Reveal`, `Counter`.
- **Typography:** Inter (`--font-inter`), tight tracking on headings, balanced
  measure (`text-balance`, `text-pretty`).
- Keep it minimal and uncluttered — generous spacing, few accent colors.

---

## 11. Animation guidelines

- **GSAP:** hero text reveal (timeline), number counters, mouse parallax. Load
  GSAP dynamically inside `useEffect` (`await import("gsap")`) and clean up with
  `gsap.context().revert()`. Never run GSAP during SSR.
- **Framer Motion:** scroll reveals (`whileInView`, `once: true`), accordions,
  nav transitions. Use the shared `<Reveal>` for section entrances.
- **Performance:** animate `transform`/`opacity` only; add `will-change` sparingly;
  respect `prefers-reduced-motion` (already handled globally in `globals.css`).
- Animations should feel smooth and premium, never block interaction or jank.

---

## 12. Responsive design rules

- **Mobile-first.** Base styles target small screens; layer `sm: md: lg:` up.
- Test at 360 / 768 / 1024 / 1440. No horizontal scroll (`overflow-x-hidden`).
- Touch targets ≥ 40px. Collapse the dashboard sidebar and nav into menus on
  small screens (see `Navbar`, `Sidebar`).

---

## 13. Accessibility standards

- Semantic HTML; one `<h1>` per page; logical heading order.
- Labels tied to inputs (`htmlFor`/`id`); visible focus rings (keep `focus:ring`).
- `aria-expanded` on toggles (FAQ, mobile nav); `alt` text on images.
- Color contrast AA on the dark theme; don't rely on color alone for status.
- Honor reduced motion (global rule already in place).

---

## 14. Git workflow & commit conventions

- Branch from `main`: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- Small, focused PRs; never commit secrets or `.env`.
- **Conventional Commits:** `type(scope): summary`
  - `feat(dashboard): add product CRUD`
  - `fix(auth): reject duplicate email on register`
  - `chore(deps): bump next to 15.x`
  - types: feat, fix, chore, refactor, docs, style, test, perf, build.
- Run typecheck/lint/build before pushing. Keep `main` always deployable.

---

## 15. Development roadmap

- **Phase 1 (current):** premium landing page, registration, login, Auth.js,
  per-restaurant workspace creation, protected dashboard shell. ✅
- **Phase 2:** dashboard CRUD — categories, products, orders, customers,
  restaurant settings; the customer ordering site at `/r/<slug>`.
- **Phase 3:** analytics, SMS notifications (Twilio), order tracking timeline,
  reports, coupons, reviews.
- **Phase 4:** full multi-tenant hardening, role-based access, performance,
  security review, deployment.

### Future feature ideas
Loyalty/points, multi-location groups, custom domains, printable kitchen
tickets, table QR ordering, payment integration (Stripe), inventory, scheduled
menus/happy hours, multi-language & multi-currency, mobile apps.

---

## 16. Best practices checklist

- [ ] Every tenant query scoped by `restaurantId` from `requireTenant()`.
- [ ] All input validated with Zod at the boundary.
- [ ] Server Components by default; `"use client"` only when needed.
- [ ] Money as `Decimal`; dates as ISO/`DateTime`.
- [ ] No native-compiled deps; no secrets in the repo.
- [ ] Accessible, responsive, reduced-motion-safe.
- [ ] Errors handled; no internal details leaked to clients.
- [ ] Typecheck + build pass before commit.

---

## 17. Local setup

```bash
cp .env.example .env          # set DATABASE_URL + AUTH_SECRET
docker compose up -d          # optional local Postgres
npm install
npm run db:migrate            # create tables
npm run dev                   # http://localhost:3000
```

Contact channels surfaced on the landing page (update in
`src/components/landing/Contact.tsx`): WhatsApp number, contact email, demo URL.
```
