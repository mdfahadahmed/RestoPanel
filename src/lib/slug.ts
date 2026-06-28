import { prisma } from "./prisma";

/** Convert arbitrary text into a URL-safe slug. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      // NFKD splits accented letters into base + combining mark; the combining
      // marks are non-alphanumeric and get stripped by the filter below.
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "restaurant"
  );
}

/**
 * Generate a restaurant slug that is unique across the platform, appending a
 * short random suffix on collision.
 */
export async function generateUniqueRestaurantSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;

  for (let attempt = 0; attempt < 6; attempt++) {
    const existing = await prisma.restaurant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Extremely unlikely fallback.
  return `${base}-${Date.now().toString(36)}`;
}
