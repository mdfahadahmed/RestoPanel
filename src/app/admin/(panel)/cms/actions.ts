"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  saveCmsPage,
  upsertFaq,
  deleteFaq,
  upsertBlogPost,
  deleteBlogPost,
  markContactRead,
} from "@/lib/admin/cms";
import {
  faqSchema,
  blogPostSchema,
  cmsPageSchema,
} from "@/lib/validations/admin";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

function fieldErrors(e: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const fe = e.flatten().fieldErrors;
  const cleaned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(fe)) if (v) cleaned[k] = v;
  return cleaned;
}

// --- Pages ----------------------------------------------------------------
export async function saveCmsPageAction(input: {
  key: string;
  title: string;
  content: Record<string, unknown>;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = cmsPageSchema.safeParse(input);
  if (!parsed.success) return actionError("Validation failed", fieldErrors(parsed.error));
  await saveCmsPage(parsed.data.key, parsed.data.title, parsed.data.content);
  revalidatePath("/admin/cms");
  return actionOk();
}

// --- FAQ ------------------------------------------------------------------
export async function saveFaqAction(
  input: Record<string, unknown> & { id?: string }
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return actionError("Validation failed", fieldErrors(parsed.error));
  await upsertFaq({ id: input.id, ...parsed.data });
  revalidatePath("/admin/cms");
  return actionOk();
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing id.");
  await deleteFaq(id);
  revalidatePath("/admin/cms");
  return actionOk();
}

// --- Blog -----------------------------------------------------------------
export async function saveBlogPostAction(
  input: Record<string, unknown> & { id?: string }
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) return actionError("Validation failed", fieldErrors(parsed.error));
  await upsertBlogPost({
    id: input.id,
    ...parsed.data,
    excerpt: parsed.data.excerpt || null,
    coverUrl: parsed.data.coverUrl || null,
  });
  revalidatePath("/admin/cms");
  return actionOk();
}

export async function deleteBlogPostAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing id.");
  await deleteBlogPost(id);
  revalidatePath("/admin/cms");
  return actionOk();
}

// --- Contact inbox --------------------------------------------------------
export async function markContactReadAction(
  id: string,
  isRead: boolean
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return actionError("Missing id.");
  await markContactRead(id, isRead);
  revalidatePath("/admin/cms");
  return actionOk();
}
