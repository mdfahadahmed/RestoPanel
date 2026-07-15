import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "./robots";

export const revalidate = 3600; // regenerate hourly

/**
 * Dynamic sitemap: static marketing pages, published blog posts, and every
 * live restaurant storefront (home + menu). Excludes authed/app surfaces, which
 * are already disallowed in robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
  ];

  // Best-effort DB reads — a sitemap must never 500, so degrade to static.
  const [posts, restaurants] = await Promise.all([
    prisma.blogPost
      .findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 1000,
      })
      .catch(() => []),
    prisma.restaurant
      .findMany({
        where: { status: "ACTIVE", platformDeletedAt: null },
        select: { slug: true, updatedAt: true },
        take: 5000,
      })
      .catch(() => []),
  ]);

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const storefrontRoutes: MetadataRoute.Sitemap = restaurants.flatMap((r) => [
    { url: `${base}/r/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${base}/r/${r.slug}/menu`, lastModified: r.updatedAt, changeFrequency: "daily" as const, priority: 0.7 },
  ]);

  return [...staticRoutes, ...postRoutes, ...storefrontRoutes];
}
