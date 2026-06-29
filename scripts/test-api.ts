/**
 * End-to-end tests for the Public REST API: API-key generation/hashing/auth,
 * scopes, DB-backed rate limiting, the versioned endpoint functions, the full
 * request gateway (handleApi over a real Request), the OpenAPI spec, and tenant
 * isolation. Runs offline against the live DB; cleans up after itself.
 *
 * Run: npx tsx scripts/test-api.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import {
  generateApiKey,
  hashApiKey,
  parseApiKey,
  createApiKey,
  authenticateApiKey,
  revokeApiKey,
} from "../src/lib/api/keys";
import { hasScope } from "../src/lib/api/scopes";
import { checkRateLimit, rateLimitHeaders } from "../src/lib/api/ratelimit";
import {
  getRestaurant,
  listProducts,
  getProduct,
  listCategories,
  listOrders,
  getOrder,
  createOrder,
  listCustomers,
  type ApiContext,
} from "../src/lib/api/endpoints";
import { handleApi } from "../src/lib/api/handle";
import { buildOpenApiSpec } from "../src/lib/api/openapi";
import { API_VERSION } from "../src/lib/api/respond";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}
const body = (res: { body: unknown }) => res.body as Record<string, unknown>;

async function main() {
  const tag = `api${Date.now().toString(36)}`;
  const D = (n: number) => new Prisma.Decimal(n);

  try {
    // ===================================================================== [1]
    console.log("\n[1] Key generation + hashing");
    const g = await generateApiKey();
    check("plaintext is rp_live_ prefixed", g.plaintext.startsWith("rp_live_") && g.plaintext.length === 40);
    check("hash is 64 hex chars", /^[0-9a-f]{64}$/.test(g.hashedKey));
    check("prefix + last4 derived from plaintext", g.prefix === g.plaintext.slice(0, 12) && g.last4 === g.plaintext.slice(-4));
    check("hashApiKey is deterministic", (await hashApiKey("abc")) === (await hashApiKey("abc")));
    check("different keys → different hashes", (await generateApiKey()).hashedKey !== g.hashedKey);

    console.log("\n[2] Header parsing + scopes");
    check("parses Bearer token", parseApiKey(new Headers({ authorization: "Bearer rp_live_xyz" })) === "rp_live_xyz");
    check("parses x-api-key", parseApiKey(new Headers({ "x-api-key": "rp_live_abc" })) === "rp_live_abc");
    check("no header → null", parseApiKey(new Headers()) === null);
    check("hasScope exact match", hasScope(["products:read"], "products:read") && !hasScope(["products:read"], "orders:read"));
    check("hasScope wildcard", hasScope(["*"], "orders:write"));

    // ===================================================================== [3]
    console.log("\n[3] Create key + authenticate (DB)");
    const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "Bella", ownerName: "Sam", currencySymbol: "£", taxRate: D(0) } });
    const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "Other", ownerName: "B" } });

    const created = await createApiKey({ restaurantId: a.id, name: "Main", scopes: ["products:read", "orders:read", "orders:write", "restaurant:read", "categories:read", "customers:read", "bogus" as never] });
    check("only valid scopes stored", !created.apiKey.scopes.includes("bogus") && created.apiKey.scopes.includes("products:read"));
    check("hashedKey stored, not plaintext", created.apiKey.hashedKey.length === 64 && created.plaintext.startsWith("rp_live_"));

    const auth = await authenticateApiKey(created.plaintext);
    check("authenticate resolves restaurant + scopes", auth?.restaurantId === a.id && auth.scopes.includes("orders:read"));
    check("wrong key → null", (await authenticateApiKey("rp_live_doesnotexist")) === null);
    check("non-prefixed key → null", (await authenticateApiKey("garbage")) === null);
    check("null → null", (await authenticateApiKey(null)) === null);

    const expiredKey = await createApiKey({ restaurantId: a.id, name: "Old", scopes: ["products:read"], expiresAt: new Date(Date.now() - 1000) });
    check("expired key → null", (await authenticateApiKey(expiredKey.plaintext)) === null);

    const revokable = await createApiKey({ restaurantId: a.id, name: "Temp", scopes: ["products:read"] });
    await revokeApiKey(a.id, revokable.apiKey.id);
    check("revoked key → null", (await authenticateApiKey(revokable.plaintext)) === null);

    // ===================================================================== [4]
    console.log("\n[4] Rate limiting (fixed window)");
    const rlKey = created.apiKey.id;
    const t0 = 1_000_000 * 60_000; // a fixed minute boundary
    const r1 = await checkRateLimit(rlKey, 3, t0);
    const r2 = await checkRateLimit(rlKey, 3, t0 + 100);
    const r3 = await checkRateLimit(rlKey, 3, t0 + 200);
    const r4 = await checkRateLimit(rlKey, 3, t0 + 300);
    check("within limit allowed, remaining decrements", r1.allowed && r1.remaining === 2 && r2.remaining === 1 && r3.remaining === 0);
    check("over limit blocked", !r4.allowed && r4.count === 4);
    check("reset is next window boundary", r1.reset === t0 + 60_000);
    const next = await checkRateLimit(rlKey, 3, t0 + 61_000);
    check("new window resets the counter", next.allowed && next.count === 1);
    check("rateLimitHeaders shape", rateLimitHeaders(r1)["X-RateLimit-Limit"] === "3");

    // ===================================================================== [5]
    console.log("\n[5] Endpoint functions");
    const cat = await prisma.category.create({ data: { restaurantId: a.id, name: "Pizza", slug: "pizza", position: 0 } });
    const p1 = await prisma.product.create({ data: { restaurantId: a.id, categoryId: cat.id, name: "Margherita", slug: "marg", price: D(10), costPrice: D(4), status: "ACTIVE", isAvailable: true } });
    await prisma.product.create({ data: { restaurantId: a.id, name: "Hidden", slug: "hidden", price: D(8), status: "ACTIVE", isAvailable: false } });
    await prisma.product.create({ data: { restaurantId: a.id, name: "Gone", slug: "gone", price: D(5), status: "ACTIVE", isAvailable: true, deletedAt: new Date() } });
    await prisma.customer.create({ data: { restaurantId: a.id, name: "Reg", phone: "+4470" } });

    const ctx: ApiContext = { restaurantId: a.id, scopes: ["*"] };

    const rest = await getRestaurant(ctx);
    check("getRestaurant 200 + scoped", rest.status === 200 && (body(rest).data as { id: string }).id === a.id);

    const prods = await listProducts(ctx);
    check("listProducts excludes soft-deleted", prods.status === 200 && (body(prods).meta as { total: number }).total === 2, (body(prods).meta));
    const avail = await listProducts(ctx, { available: true });
    check("available filter works", (body(avail).meta as { total: number }).total === 1);

    const prod = await getProduct(ctx, p1.id);
    const prodData = body(prod).data as Record<string, unknown>;
    check("getProduct 200", prod.status === 200 && prodData.id === p1.id);
    check("serializer hides costPrice", !("costPrice" in prodData) && prodData.price === 10);
    check("getProduct missing → 404", (await getProduct(ctx, "nope")).status === 404);
    check("getProduct cross-tenant → 404", (await getProduct({ restaurantId: b.id, scopes: ["*"] }, p1.id)).status === 404);

    const cats = await listCategories(ctx);
    check("listCategories with productCount", cats.status === 200 && Array.isArray(body(cats).data));

    const newOrder = await createOrder(ctx, { type: "PICKUP", customer: { name: "Joe", phone: "+4471" }, items: [{ productId: p1.id, quantity: 2 }] });
    const orderData = body(newOrder).data as { id: string; total: number; items: unknown[] };
    check("createOrder 201 + computed total", newOrder.status === 201 && orderData.total === 20 && orderData.items.length === 1);
    check("createOrder invalid body → 422", (await createOrder(ctx, { customer: {} })).status === 422);
    check("createOrder bad product → 422", (await createOrder(ctx, { customer: { name: "X", phone: "+1" }, items: [{ productId: "nope", quantity: 1 }] })).status === 422);

    const orders = await listOrders(ctx);
    check("listOrders returns the new order", (body(orders).meta as { total: number }).total >= 1);
    const oneOrder = await getOrder(ctx, orderData.id);
    check("getOrder 200", oneOrder.status === 200);
    check("getOrder cross-tenant → 404", (await getOrder({ restaurantId: b.id, scopes: ["*"] }, orderData.id)).status === 404);

    const customers = await listCustomers(ctx);
    check("listCustomers scoped", customers.status === 200 && (body(customers).meta as { total: number }).total === 1);

    // ===================================================================== [6]
    console.log("\n[6] Request gateway (handleApi)");
    const bearer = (key: string) => new Request("http://localhost/api/v1/restaurant", { headers: { Authorization: `Bearer ${key}` } });

    const okRes = await handleApi(bearer(created.plaintext), (c) => getRestaurant(c), { scope: "restaurant:read" });
    check("authorized request → 200", okRes.status === 200);
    check("attaches X-API-Version", okRes.headers.get("X-API-Version") === API_VERSION);
    check("attaches rate-limit headers", okRes.headers.get("X-RateLimit-Limit") !== null);
    const okJson = await okRes.json();
    check("body is the resource", okJson.data.id === a.id);

    const noKey = await handleApi(new Request("http://localhost/api/v1/restaurant"), (c) => getRestaurant(c), { scope: "restaurant:read" });
    check("missing key → 401", noKey.status === 401 && noKey.headers.get("WWW-Authenticate") === "Bearer");

    // Key with only products:read, but endpoint needs restaurant:read.
    const limited = await createApiKey({ restaurantId: a.id, name: "Limited", scopes: ["products:read"] });
    const forbidden = await handleApi(bearer(limited.plaintext), (c) => getRestaurant(c), { scope: "restaurant:read" });
    check("insufficient scope → 403", forbidden.status === 403);
    const allowedScope = await handleApi(new Request("http://localhost/api/v1/products", { headers: { Authorization: `Bearer ${limited.plaintext}` } }), (c) => listProducts(c), { scope: "products:read" });
    check("sufficient scope → 200", allowedScope.status === 200);

    // Rate limit through the gateway: a 1/min key blocks the 2nd call.
    const burst = await createApiKey({ restaurantId: a.id, name: "Burst", scopes: ["products:read"], rateLimitPerMin: 1 });
    const call1 = await handleApi(new Request("http://localhost/api/v1/products", { headers: { Authorization: `Bearer ${burst.plaintext}` } }), (c) => listProducts(c), { scope: "products:read" });
    const call2 = await handleApi(new Request("http://localhost/api/v1/products", { headers: { Authorization: `Bearer ${burst.plaintext}` } }), (c) => listProducts(c), { scope: "products:read" });
    check("gateway enforces rate limit (1st ok, 2nd 429)", call1.status === 200 && call2.status === 429 && call2.headers.get("Retry-After") !== null);

    // ===================================================================== [7]
    console.log("\n[7] OpenAPI spec");
    const spec = buildOpenApiSpec();
    check("openapi 3.0.3 + version", spec.openapi === "3.0.3" && spec.info.version === API_VERSION);
    check("documents core paths", "/products" in spec.paths && "/orders" in spec.paths && "/restaurant" in spec.paths);
    check("declares bearer security scheme", spec.components.securitySchemes.ApiKeyAuth.scheme === "bearer");
    check("orders path documents POST", "post" in spec.paths["/orders"]);

    // ===================================================================== [8]
    console.log("\n[8] Tenant isolation");
    const bKey = await createApiKey({ restaurantId: b.id, name: "B", scopes: ["*"] });
    const bAuth = await authenticateApiKey(bKey.plaintext);
    check("B key resolves to B", bAuth?.restaurantId === b.id);
    const bProducts = await listProducts({ restaurantId: b.id, scopes: ["*"] });
    check("B sees none of A's products", (body(bProducts).meta as { total: number }).total === 0);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades keys/windows/products/orders/customers/categories
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
