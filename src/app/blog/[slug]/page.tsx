import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { getPublishedPost } from "@/lib/marketing/content";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Post not found — RestoPanel" };
  return {
    title: `${post.title} — RestoPanel Blog`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverUrl ? [post.coverUrl] : undefined,
      type: "article",
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  // Content is authored as plain text in the CMS. Render as paragraphs (split on
  // blank lines) rather than raw HTML, so there's no injection surface.
  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-fog-400 transition hover:text-fog-100"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <article className="mt-6">
          <p className="text-xs text-fog-500">
            {formatDate(post.publishedAt ?? post.createdAt, { hour: undefined, minute: undefined })} ·{" "}
            {post.author}
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-4 text-pretty text-lg leading-relaxed text-fog-400">
              {post.excerpt}
            </p>
          )}

          {post.coverUrl && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-ink-850">
              <Image
                src={post.coverUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="mt-8 space-y-5 text-pretty leading-relaxed text-fog-300">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p className="text-fog-500">This article is coming soon.</p>
            )}
          </div>
        </article>

        <div className="mt-14 rounded-3xl border border-line bg-gradient-to-br from-ink-900 to-ink-950 p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-fog-50">
            Ready to put your restaurant online?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fog-400">
            Spin up your dashboard and branded ordering site in minutes.
          </p>
          <Link
            href="/register"
            className="btn-glow mt-6 inline-block rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
          >
            Get started free
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
