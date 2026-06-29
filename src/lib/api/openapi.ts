import { API_SCOPES, SCOPE_DESCRIPTIONS } from "./scopes";
import { API_VERSION } from "./respond";

/**
 * Builds the OpenAPI 3.0 document describing the public v1 API. Served as JSON
 * at /api/v1/openapi.json and rendered by the Swagger UI at /docs.
 */
export function buildOpenApiSpec() {
  const scopeList = API_SCOPES.map((s) => `\`${s}\` — ${SCOPE_DESCRIPTIONS[s]}`).join("\n");

  const rateLimitHeaders = {
    "X-RateLimit-Limit": { schema: { type: "integer" }, description: "Requests allowed per minute" },
    "X-RateLimit-Remaining": { schema: { type: "integer" }, description: "Requests remaining in the window" },
    "X-RateLimit-Reset": { schema: { type: "integer" }, description: "Unix time (s) when the window resets" },
  };

  const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });

  const commonResponses = {
    "401": errorResponse("Missing or invalid API key"),
    "403": errorResponse("API key lacks the required scope"),
    "429": errorResponse("Rate limit exceeded"),
  };

  const listParams = [
    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
    { name: "perPage", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
  ];

  return {
    openapi: "3.0.3",
    info: {
      title: "RestoPanel Public API",
      version: API_VERSION,
      description:
        "REST API for a restaurant's RestoPanel data.\n\n" +
        "## Authentication\nSend your secret key as a bearer token: `Authorization: Bearer rp_live_…` " +
        "(or the `x-api-key` header).\n\n" +
        "## Rate limiting\nEach key has a per-minute limit; responses include `X-RateLimit-*` headers " +
        "and exceeding it returns `429`.\n\n" +
        `## Scopes\n${scopeList}`,
    },
    servers: [{ url: "/api/v1", description: "Version 1" }],
    security: [{ ApiKeyAuth: [] }],
    tags: [
      { name: "Meta" }, { name: "Restaurant" }, { name: "Products" },
      { name: "Categories" }, { name: "Orders" }, { name: "Customers" },
    ],
    paths: {
      "/": {
        get: {
          tags: ["Meta"], summary: "API index", operationId: "getIndex",
          responses: { "200": { description: "API metadata" }, ...commonResponses },
        },
      },
      "/restaurant": {
        get: {
          tags: ["Restaurant"], summary: "Get the restaurant profile", operationId: "getRestaurant",
          responses: {
            "200": { description: "Restaurant", headers: rateLimitHeaders, content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Restaurant" } } } } } },
            ...commonResponses,
          },
        },
      },
      "/products": {
        get: {
          tags: ["Products"], summary: "List products", operationId: "listProducts",
          parameters: [
            ...listParams,
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "available", in: "query", schema: { type: "boolean" } },
          ],
          responses: {
            "200": { description: "Paginated products", headers: rateLimitHeaders, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductList" } } } },
            ...commonResponses,
          },
        },
      },
      "/products/{id}": {
        get: {
          tags: ["Products"], summary: "Get a product", operationId: "getProduct",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Product", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Product" } } } } } },
            "404": errorResponse("Product not found"), ...commonResponses,
          },
        },
      },
      "/categories": {
        get: {
          tags: ["Categories"], summary: "List categories", operationId: "listCategories",
          responses: { "200": { description: "Categories", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Category" } } } } } } }, ...commonResponses },
        },
      },
      "/orders": {
        get: {
          tags: ["Orders"], summary: "List orders", operationId: "listOrders",
          parameters: [...listParams, { name: "status", in: "query", schema: { type: "string" } }],
          responses: { "200": { description: "Paginated orders", headers: rateLimitHeaders, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderList" } } } }, ...commonResponses },
        },
        post: {
          tags: ["Orders"], summary: "Create an order", operationId: "createOrder",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/NewOrder" } } } },
          responses: {
            "201": { description: "Created order", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } } },
            "422": errorResponse("Validation error"), ...commonResponses,
          },
        },
      },
      "/orders/{id}": {
        get: {
          tags: ["Orders"], summary: "Get an order", operationId: "getOrder",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Order", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } } }, "404": errorResponse("Order not found"), ...commonResponses },
        },
      },
      "/customers": {
        get: {
          tags: ["Customers"], summary: "List customers", operationId: "listCustomers",
          parameters: [...listParams, { name: "search", in: "query", schema: { type: "string" } }],
          responses: { "200": { description: "Paginated customers", headers: rateLimitHeaders, content: { "application/json": { schema: { $ref: "#/components/schemas/CustomerList" } } } }, ...commonResponses },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "http", scheme: "bearer", bearerFormat: "rp_live_…", description: "Your secret API key" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "object" } } } },
        },
        Pagination: {
          type: "object",
          properties: { page: { type: "integer" }, perPage: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" } },
        },
        Restaurant: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, slug: { type: "string" },
            email: { type: "string", nullable: true }, phone: { type: "string", nullable: true },
            currency: { type: "string" }, currencySymbol: { type: "string" },
            deliveryEnabled: { type: "boolean" }, pickupEnabled: { type: "boolean" }, dineInEnabled: { type: "boolean" },
            minimumOrder: { type: "number" }, deliveryFee: { type: "number" }, taxRate: { type: "number" },
          },
        },
        Category: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, position: { type: "integer" }, isActive: { type: "boolean" }, productCount: { type: "integer" } },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, slug: { type: "string" },
            description: { type: "string", nullable: true }, categoryId: { type: "string", nullable: true },
            price: { type: "number" }, comparePrice: { type: "number", nullable: true }, discount: { type: "number" },
            images: { type: "array", items: { type: "object" } }, isAvailable: { type: "boolean" },
            status: { type: "string" }, featured: { type: "boolean" }, bestSeller: { type: "boolean" },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: { type: "string" }, orderNumber: { type: "string" }, type: { type: "string" }, status: { type: "string" },
            paymentStatus: { type: "string" }, paymentMethod: { type: "string" },
            customerName: { type: "string", nullable: true }, customerPhone: { type: "string", nullable: true },
            subtotal: { type: "number" }, taxAmount: { type: "number" }, deliveryFee: { type: "number" }, total: { type: "number" },
            items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "integer" }, unitPrice: { type: "number" }, lineTotal: { type: "number" } } } },
          },
        },
        Customer: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string", nullable: true }, phone: { type: "string" }, email: { type: "string", nullable: true }, status: { type: "string" }, totalOrders: { type: "integer" } },
        },
        NewOrder: {
          type: "object",
          required: ["customer", "items"],
          properties: {
            type: { type: "string", enum: ["DELIVERY", "PICKUP", "DINE_IN"], default: "PICKUP" },
            paymentMethod: { type: "string", enum: ["CASH", "CARD", "ONLINE"], default: "CASH" },
            customer: { type: "object", required: ["name", "phone"], properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" } } },
            items: { type: "array", items: { type: "object", required: ["productId", "quantity"], properties: { productId: { type: "string" }, quantity: { type: "integer", minimum: 1 }, variant: { type: "object", properties: { name: { type: "string" } } }, extras: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } } } } },
            notes: { type: "string" },
          },
        },
        ProductList: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Product" } }, meta: { $ref: "#/components/schemas/Pagination" } } },
        OrderList: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Order" } }, meta: { $ref: "#/components/schemas/Pagination" } } },
        CustomerList: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Customer" } }, meta: { $ref: "#/components/schemas/Pagination" } } },
      },
    },
  } as const;
}
