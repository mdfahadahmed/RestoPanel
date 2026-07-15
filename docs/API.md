# RestoPanel API Reference

The public REST API (`v1`) lets you integrate a restaurant's RestoPanel data with
your own systems. It is **tenant-scoped by API key** — a key resolves to exactly
one restaurant, and every response is limited to that restaurant's data.

- **Base URL:** `https://YOUR-DOMAIN/api/v1`
- **Version:** `1.0.0` (also returned in the `X-API-Version` response header)
- **Format:** JSON request/response
- **Interactive:** browsable docs at `/docs`; machine-readable spec at
  `/api/v1/openapi.json` (OpenAPI 3.0.3)

## Authentication

Create keys in the dashboard under **Developer API** (`/dashboard/api`). A key is
shown **once** at creation (prefix `rp_live_…`) — store it securely; only its hash
is kept server-side.

Send the key on every request, either way:

```http
Authorization: Bearer rp_live_xxxxxxxxxxxxxxxxxxxx
```
```http
x-api-key: rp_live_xxxxxxxxxxxxxxxxxxxx
```

Keys can be given an **expiry** and can be **revoked** at any time. Optionally an
**IP allowlist** restricts which addresses may use a key. Missing/invalid/expired/
revoked keys return `401`.

## Scopes

Each key holds a set of scopes; a request needs the scope for its endpoint or it
returns `403`. The wildcard `*` grants everything.

| Scope | Grants |
|---|---|
| `restaurant:read` | Read the restaurant profile & settings |
| `products:read` | List and read products |
| `categories:read` | List categories |
| `orders:read` | List and read orders |
| `orders:write` | Create orders |
| `customers:read` | List customers |

## Rate limiting

Each key has a per-minute limit (fixed window). Every response includes:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Requests allowed per minute |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Unix time (seconds) when the window resets |

Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

## Responses

Single resource:
```json
{ "data": { "id": "…", "name": "…" } }
```

Collection (paginated):
```json
{
  "data": [ { "…": "…" } ],
  "meta": { "page": 1, "perPage": 20, "total": 42, "totalPages": 3 }
}
```

List query params: `page` (default 1), `perPage` (default 20, max 100), plus
per-endpoint filters below.

### Errors

```json
{ "error": { "code": "validation_error", "message": "Invalid request body", "details": { } } }
```

| Status | When |
|---|---|
| `400` | Malformed request |
| `401` | Missing/invalid API key |
| `403` | Key lacks the required scope |
| `404` | Resource not found (or not in this restaurant) |
| `422` | Validation failed (`details` has field errors) |
| `429` | Rate limit exceeded |

## Endpoints

### Meta
| Method | Path | Scope | Description |
|---|---|---|---|
| GET | `/api/v1` | — | API index (name, version, resources) |
| GET | `/api/v1/openapi.json` | — | OpenAPI 3.0.3 spec |

### Restaurant
| Method | Path | Scope |
|---|---|---|
| GET | `/api/v1/restaurant` | `restaurant:read` |

Returns the restaurant profile (sensitive internal fields like cost prices are
never exposed).

### Products
| Method | Path | Scope | Query |
|---|---|---|---|
| GET | `/api/v1/products` | `products:read` | `page`, `perPage`, `search`, `categoryId`, `available` (bool) |
| GET | `/api/v1/products/{id}` | `products:read` | — |

Soft-deleted products are excluded.

### Categories
| Method | Path | Scope |
|---|---|---|
| GET | `/api/v1/categories` | `categories:read` |

Includes a `productCount` per category.

### Orders
| Method | Path | Scope | Query |
|---|---|---|---|
| GET | `/api/v1/orders` | `orders:read` | `page`, `perPage`, `status` |
| GET | `/api/v1/orders/{id}` | `orders:read` | — |
| POST | `/api/v1/orders` | `orders:write` | — |

**Create an order** — prices, tax, and delivery are computed **server-side** from
the restaurant's settings; you don't send amounts. Item prices are validated
against live products.

```http
POST /api/v1/orders
Authorization: Bearer rp_live_…
Content-Type: application/json
```
```json
{
  "type": "DELIVERY",
  "paymentMethod": "CASH",
  "customer": {
    "name": "Jane Doe",
    "phone": "+447700900123",
    "email": "jane@example.com",
    "address": "1 High St, London"
  },
  "items": [
    { "productId": "prod_abc", "quantity": 2,
      "variant": { "name": "Large", "priceAdjustment": 1.5 },
      "extras": [ { "name": "Extra cheese", "price": 0.8 } ] }
  ],
  "notes": "Ring the bell"
}
```

Returns `201` with the created order (including computed totals and line items).
Invalid bodies or unknown products return `422`.

### Customers
| Method | Path | Scope | Query |
|---|---|---|---|
| GET | `/api/v1/customers` | `customers:read` | `page`, `perPage`, `search` |

## Example

```bash
curl -s https://YOUR-DOMAIN/api/v1/products?available=true \
  -H "Authorization: Bearer rp_live_xxxxxxxxxxxxxxxxxxxx"
```

## Mobile API

A separate namespace (`/api/v1/mobile/*`) powers first-party mobile apps using
device-based JWT auth (login / refresh / logout, `me`, device registration, sync,
push test) — distinct from the API-key REST endpoints above.

## Webhooks

- **Stripe** → `POST /api/stripe/webhook`. Signatures are verified against
  `STRIPE_WEBHOOK_SECRET`; handling is idempotent (duplicate deliveries are
  ignored). Configure the endpoint in your Stripe dashboard after deploying.

## Health

`GET /api/health` — liveness + database readiness probe. `200` when healthy,
`503` when a check fails. Not authenticated; safe for uptime monitors.
