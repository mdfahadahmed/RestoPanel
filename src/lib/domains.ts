import { prisma } from "@/lib/prisma";

/**
 * Custom-domain support. A restaurant can attach a verified hostname that serves
 * its storefront; requests arriving on that host resolve to the tenant here.
 * Pure helpers are split from the DB lookup so they're trivially testable.
 */

/** Lowercase a host, strip any scheme, port and trailing dot. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const RESERVED = new Set(["localhost", "vercel.app", "now.sh"]);

/** A syntactically valid, non-reserved public domain (not an IP, not localhost). */
export function isValidDomain(input: string): boolean {
  const host = normalizeHost(input);
  if (!host || RESERVED.has(host)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false; // IPv4
  if (host.endsWith(".vercel.app") || host.endsWith(".localhost")) return false;
  return HOSTNAME_RE.test(host);
}

/** Candidate forms to match against stored domains (with and without `www.`). */
export function hostCandidates(host: string): string[] {
  const h = normalizeHost(host);
  const bare = h.replace(/^www\./, "");
  return [...new Set([h, bare, `www.${bare}`])];
}

/** Is this host one of the platform's own domains (so use normal routing)? */
export function isPlatformHost(host: string, appHosts: string[]): boolean {
  const h = normalizeHost(host);
  return appHosts.map(normalizeHost).some((a) => a === h || h.endsWith(`.${a}`));
}

/**
 * Resolve an incoming host to the restaurant whose verified custom domain it
 * matches. Returns null for platform hosts or unmatched/unverified domains.
 */
export async function resolveRestaurantByHost(host: string, appHosts: string[]) {
  if (!host || isPlatformHost(host, appHosts)) return null;
  const candidates = hostCandidates(host);
  const restaurant = await prisma.restaurant.findFirst({
    where: { customDomain: { in: candidates }, customDomainVerifiedAt: { not: null } },
    select: { id: true, slug: true, name: true, customDomain: true },
  });
  return restaurant;
}

/** The platform's own hostnames, from env (used by routing to skip resolution). */
export function appHostsFromEnv(): string[] {
  const hosts: string[] = [];
  for (const v of [process.env.APP_HOST, process.env.NEXT_PUBLIC_APP_URL, process.env.AUTH_URL]) {
    if (!v) continue;
    try {
      hosts.push(normalizeHost(v.includes("://") ? new URL(v).host : v));
    } catch {
      /* ignore malformed env */
    }
  }
  return hosts.length ? hosts : ["localhost"];
}
