import { prisma } from "@/lib/prisma";

/** CMS data: marketing pages, FAQ, blog and contact inbox. */

// --- Singleton pages (landing / pricing / contact) -------------------------
export async function getCmsPage(key: string) {
  return prisma.cmsPage.findUnique({ where: { key } });
}

export async function saveCmsPage(
  key: string,
  title: string,
  content: Record<string, unknown>
) {
  return prisma.cmsPage.upsert({
    where: { key },
    create: { key, title, content: content as object },
    update: { title, content: content as object },
  });
}

// --- FAQ -------------------------------------------------------------------
export async function listFaqs() {
  return prisma.faqItem.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

export async function upsertFaq(input: {
  id?: string;
  question: string;
  answer: string;
  category: string;
  position: number;
  isPublished: boolean;
}) {
  const { id, ...data } = input;
  return id
    ? prisma.faqItem.update({ where: { id }, data })
    : prisma.faqItem.create({ data });
}

export async function deleteFaq(id: string) {
  return prisma.faqItem.delete({ where: { id } });
}

// --- Blog ------------------------------------------------------------------
export async function listBlogPosts() {
  return prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
}

export async function upsertBlogPost(input: {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  coverUrl?: string | null;
  author: string;
  status: "DRAFT" | "PUBLISHED";
}) {
  const { id, ...rest } = input;
  const publishedAt =
    rest.status === "PUBLISHED" ? new Date() : null;
  const data = {
    ...rest,
    excerpt: rest.excerpt || null,
    coverUrl: rest.coverUrl || null,
    publishedAt,
  };
  return id
    ? prisma.blogPost.update({ where: { id }, data })
    : prisma.blogPost.create({ data });
}

export async function deleteBlogPost(id: string) {
  return prisma.blogPost.delete({ where: { id } });
}

// --- Contact inbox ---------------------------------------------------------
export async function listContactMessages(onlyUnread = false) {
  return prisma.contactMessage.findMany({
    where: onlyUnread ? { isRead: false } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markContactRead(id: string, isRead = true) {
  return prisma.contactMessage.update({ where: { id }, data: { isRead } });
}
