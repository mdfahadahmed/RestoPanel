/**
 * Tiny structured logger — JSON lines in production (so Vercel / log drains can
 * parse them), pretty text in development. Dependency-free. Sensitive keys are
 * redacted from the structured context so secrets never reach the logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEYS = [
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "authorization",
  "apikey",
  "hashedkey",
  "pushtoken",
  "cookie",
];

function minLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || "").toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") return env;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/** Redact obviously-sensitive keys from a flat/nested context object. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.includes(k.toLowerCase()) ? "[redacted]" : redact(v, seen);
  }
  return out;
}

export interface LogRecord {
  level: LogLevel;
  message: string;
  time: string;
  [key: string]: unknown;
}

/** Build the structured record for a log line (pure — used directly in tests). */
export function buildRecord(level: LogLevel, message: string, context?: Record<string, unknown>): LogRecord {
  return {
    level,
    message,
    time: new Date().toISOString(),
    ...((redact(context ?? {}) as Record<string, unknown>) ?? {}),
  };
}

export function shouldLog(level: LogLevel, threshold: LogLevel = minLevel()): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[threshold];
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const record = buildRecord(level, message, context);
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(record) : `[${level}] ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line, process.env.NODE_ENV === "production" ? "" : (context ?? ""));
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
