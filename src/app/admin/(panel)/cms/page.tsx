import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  getCmsPage,
  listFaqs,
  listBlogPosts,
  listContactMessages,
} from "@/lib/admin/cms";
import { CmsManager } from "./CmsManager";

export const dynamic = "force-dynamic";

function asStringRecord(content: unknown): Record<string, string> {
  if (!content || typeof content !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export default async function CmsPage() {
  const [landing, pricing, contactPage, faqs, posts, contacts] = await Promise.all([
    getCmsPage("landing"),
    getCmsPage("pricing"),
    getCmsPage("contact"),
    listFaqs(),
    listBlogPosts(),
    listContactMessages(),
  ]);

  return (
    <>
      <PageHeader
        title="Content Management"
        description="Edit the public marketing site: landing, pricing, FAQ, blog and contact."
      />
      <CmsManager
        landing={{ title: landing?.title ?? "Landing", content: asStringRecord(landing?.content) }}
        pricing={{ title: pricing?.title ?? "Pricing", content: asStringRecord(pricing?.content) }}
        contactPage={{ title: contactPage?.title ?? "Contact", content: asStringRecord(contactPage?.content) }}
        faqs={faqs.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category,
          position: f.position,
          isPublished: f.isPublished,
        }))}
        posts={posts.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          content: p.content,
          author: p.author,
          status: p.status,
        }))}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          restaurant: c.restaurant,
          message: c.message,
          isRead: c.isRead,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
