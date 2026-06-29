/** Permission scopes a public API key can hold. `*` grants everything. */
export const API_SCOPES = [
  "restaurant:read",
  "products:read",
  "categories:read",
  "orders:read",
  "orders:write",
  "customers:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "restaurant:read": "Read the restaurant profile & settings",
  "products:read": "List and read products",
  "categories:read": "List categories",
  "orders:read": "List and read orders",
  "orders:write": "Create orders",
  "customers:read": "List customers",
};

/** True when the granted scopes satisfy `required` (wildcard `*` allowed). */
export function hasScope(granted: string[], required: ApiScope): boolean {
  return granted.includes("*") || granted.includes(required);
}

export function isValidScope(scope: string): scope is ApiScope {
  return (API_SCOPES as readonly string[]).includes(scope) || scope === "*";
}
