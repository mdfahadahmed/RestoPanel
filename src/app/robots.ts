import type { MetadataRoute } from "next";

/** The public base URL (falls back to localhost in dev). */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep authed/app + API surfaces out of the index.
        disallow: ["/dashboard", "/admin", "/account", "/api", "/print", "/q/", "/pay/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
