/**
 * IP allowlisting for API keys and admin restrictions. Pure, dependency-free.
 * Supports exact IPv4/IPv6 matches and IPv4 CIDR ranges. An empty allowlist
 * means "no restriction".
 */

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || null;
}

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** Is an IPv4 address inside a CIDR block (e.g. "10.0.0.0/8")? */
export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/** Match an IP against a single allowlist entry (exact or CIDR). */
export function matchesEntry(ip: string, entry: string): boolean {
  const e = entry.trim();
  if (!e) return false;
  if (e.includes("/")) return ipv4InCidr(ip, e);
  return ip.trim() === e;
}

/**
 * Is `ip` allowed by `allowlist`? An empty/unset allowlist allows everything.
 * A non-empty allowlist with a null/unknown IP denies (fail closed).
 */
export function ipAllowed(ip: string | null, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!ip) return false;
  return allowlist.some((entry) => matchesEntry(ip, entry));
}
