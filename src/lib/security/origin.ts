import { appHostsFromEnv, normalizeHost } from "@/lib/domains";

/**
 * CSRF defence-in-depth for state-changing Server Actions. Next.js already
 * rejects cross-origin Server Action POSTs by comparing Origin↔Host, but we add
 * an explicit allowlist check on sensitive auth actions so the guarantee is
 * visible and testable rather than implicit.
 *
 * Policy: if an `Origin` (or `Referer`) header is present it MUST resolve to a
 * trusted host — the request's own Host plus any configured platform hosts and
 * verified custom domains. When no Origin/Referer is sent (some same-origin
 * navigations omit it) we fail open, matching browser same-origin semantics.
 */
export function isTrustedOrigin(headers: Headers, extraHosts: string[] = []): boolean {
  const origin = headers.get("origin") ?? headers.get("referer");
  if (!origin) return true; // no cross-site signal to reject

  let originHost: string;
  try {
    originHost = normalizeHost(new URL(origin).host);
  } catch {
    return false; // malformed Origin → reject
  }

  const requestHost = normalizeHost(
    headers.get("x-forwarded-host") ?? headers.get("host") ?? ""
  );

  const trusted = new Set(
    [requestHost, ...appHostsFromEnv(), ...extraHosts]
      .filter(Boolean)
      .map(normalizeHost)
  );
  return trusted.has(originHost);
}
