import { log, redact } from "@/lib/log";

/**
 * Provider-agnostic error monitoring. If a Sentry DSN or a generic error webhook
 * is configured it forwards the event there; otherwise it falls back to the
 * structured logger. Mirrors the email/SMS/push pattern: configuration is env-
 * driven and absence is a graceful no-op, never a crash.
 */

export interface ErrorEvent {
  message: string;
  name: string;
  stack?: string;
  context?: Record<string, unknown>;
  level: "error" | "warning";
  time: string;
  environment: string;
}

export function isMonitoringConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.ERROR_WEBHOOK_URL);
}

/** Normalise an unknown thrown value into a structured, redacted event. */
export function toErrorEvent(
  err: unknown,
  context?: Record<string, unknown>,
  level: ErrorEvent["level"] = "error"
): ErrorEvent {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  return {
    message: e.message,
    name: e.name || "Error",
    stack: e.stack,
    context: (redact(context ?? {}) as Record<string, unknown>) ?? {},
    level,
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
  };
}

/**
 * Report an error. Always logs; additionally ships to the configured provider
 * (best-effort, never throws, never blocks the caller). Returns the event so
 * callers/tests can assert on it.
 */
export async function captureError(
  err: unknown,
  context?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<ErrorEvent> {
  const event = toErrorEvent(err, context);
  log.error(event.message, { name: event.name, ...event.context });

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (webhook) {
    fetchImpl(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => undefined);
  }
  // A real Sentry DSN would be wired here via @sentry/nextjs when installed;
  // until then the DSN presence still routes through the webhook/logger path.
  return event;
}
