# RestoPanel Documentation

RestoPanel is a cloud, multi-tenant restaurant management SaaS: a black-themed
admin dashboard plus a branded customer ordering site for every restaurant.

## Guides

| Doc | For | Covers |
|---|---|---|
| [Installation](./INSTALLATION.md) | Developers | Local setup, env vars, database, scripts, troubleshooting |
| [Deployment](./DEPLOYMENT.md) | Operators | Vercel + Neon + Cloudinary + Resend + Stripe, SSL, env vars |
| [Super Admin Guide](./ADMIN_GUIDE.md) | Platform operators | `/admin` — restaurants, billing, subscriptions, CMS, support, provider settings |
| [Restaurant Owner Guide](./OWNER_GUIDE.md) | Restaurant owners/staff | `/dashboard` — menu, orders, customers, reservations, analytics, security, billing |
| [Customer Guide](./CUSTOMER_GUIDE.md) | Diners | Storefront `/r/<slug>` and account `/account` |
| [API Reference](./API.md) | Integrators | REST `v1` — auth, scopes, endpoints, rate limits, webhooks |

## The three audiences (and their isolation)

- **Super admin** (`AdminUser`) → `/admin`, HMAC session — manages the platform.
- **Restaurant owner/staff** (`User`) → `/dashboard` — manages one restaurant;
  every query is scoped by `restaurantId`.
- **Customer** (`CustomerAccount`) → `/account` and storefronts — one account
  across all restaurants; strictly isolated to their own data.

See the root [`CLAUDE.md`](../CLAUDE.md) for architecture, conventions, and the
engineering guide.
