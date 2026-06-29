/** Versioned API response helpers. */

export const API_VERSION = "1.0.0";
export const API_VERSION_TAG = "v1";

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function ok(body: unknown, headers?: Record<string, string>): ApiResponse {
  return { status: 200, body, headers };
}

export function created(body: unknown): ApiResponse {
  return { status: 201, body };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): ApiResponse {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return { status, body };
}

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(data: T[], meta: Omit<PageMeta, "totalPages">): ApiResponse {
  return ok({
    data,
    meta: { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.perPage)) },
  });
}
