import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Newspaper } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { getPublishedPosts } from "@/lib/marketing/content";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog — RestoPanel",
  description:
    "Product updates, guides and stories for restaurant owners running on RestoPanel.",
};

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <header className="max-w-2xl">
          <span className="inline-block rounded-full border border-line bg-ink-900/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-violet-300">
            Blog
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Ideas for modern restaurants
          </h1>
          <p className="mt-3 text-pretty text-fog-400">
            Product news, playbooks and lessons from restaurants growing online
            with RestoPanel.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="mt-16 grid place-items-center rounded-3xl border border-dashed border-line bg-ink-900/40 px-6 py-20 text-center">
            <Newspaper className="h-10 w-10 text-fog-700" />
            <h2 className="mt-4 text-lg font-medium text-fog-100">No posts yet</h2>
            <p className="mt-1 max-w-sm text-sm text-fog-500">
              We&apos;re cooking up our first stories. Check back soon — or{" "}
              <Link href="/#contact" className="text-violet-300 hover:text-violet-200">
                get in touch
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-12 space-y-10">
            {featured && <FeaturedCard post={featured} />}
            {rest.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

type PostSummary = Awaited<ReturnType<typeof getPublishedPosts>>[number];

function postDate(post: PostSummary) {
  return formatDate(post.publishedAt ?? post.createdAt, {
    hour: undefined,
    minute: undefined,
  });
}

function FeaturedCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid overflow-hidden rounded-3xl border border-line bg-ink-900/40 transition hover:border-fog-700 lg:grid-cols-2"
    >
      <div className="relative aspect-[16/10] bg-ink-850 lg:aspect-auto">
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt={post.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full min-h-56 place-items-center bg-mesh text-fog-700">
            <Newspaper className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center p-8 sm:p-10">
        <p className="text-xs text-fog-500">
          {postDate(post)} · {post.author}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fog-50">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-pretty text-fog-400">{post.excerpt}</p>
        )}
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-violet-300">
          Read article <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900/40 transition hover:border-fog-700"
    >
      <div className="relative aspect-[16/10] bg-ink-850">
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-mesh text-fog-700">
            <Newspaper className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-fog-500">{postDate(post)}</p>
        <h3 className="mt-1.5 font-semibold text-fog-100 transition group-hover:text-white">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm text-fog-500">{post.excerpt}</p>
        )}
      </div>
    </Link>
  );
}
