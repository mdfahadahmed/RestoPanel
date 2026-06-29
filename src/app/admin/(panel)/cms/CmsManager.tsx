"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, MailOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/admin/format";
import {
  saveCmsPageAction,
  saveFaqAction,
  deleteFaqAction,
  saveBlogPostAction,
  deleteBlogPostAction,
  markContactReadAction,
} from "./actions";

// ---- shared types ----
interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  position: number;
  isPublished: boolean;
}
interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  author: string;
  status: "DRAFT" | "PUBLISHED";
}
interface Contact {
  id: string;
  name: string;
  email: string;
  restaurant: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-fog-300">{label}</span>
      {children}
    </label>
  );
}

export function CmsManager({
  landing,
  pricing,
  contactPage,
  faqs,
  posts,
  contacts,
}: {
  landing: { title: string; content: Record<string, string> };
  pricing: { title: string; content: Record<string, string> };
  contactPage: { title: string; content: Record<string, string> };
  faqs: Faq[];
  posts: Post[];
  contacts: Contact[];
}) {
  return (
    <Tabs defaultValue="landing">
      <TabsList className="flex-wrap">
        <TabsTrigger value="landing">Landing</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="blog">Blog</TabsTrigger>
        <TabsTrigger value="contact">Contact</TabsTrigger>
      </TabsList>

      <TabsContent value="landing">
        <PageEditor
          pageKey="landing"
          initialTitle={landing.title}
          fields={[
            { key: "headline", label: "Hero headline" },
            { key: "subheadline", label: "Hero subheadline", textarea: true },
            { key: "ctaText", label: "Primary CTA text" },
            { key: "ctaHref", label: "Primary CTA link" },
          ]}
          initialContent={landing.content}
        />
      </TabsContent>

      <TabsContent value="pricing">
        <PageEditor
          pageKey="pricing"
          initialTitle={pricing.title}
          fields={[
            { key: "heading", label: "Section heading" },
            { key: "subheading", label: "Section subheading", textarea: true },
            { key: "note", label: "Footnote" },
          ]}
          initialContent={pricing.content}
        />
      </TabsContent>

      <TabsContent value="faq">
        <FaqManager faqs={faqs} />
      </TabsContent>

      <TabsContent value="blog">
        <BlogManager posts={posts} />
      </TabsContent>

      <TabsContent value="contact">
        <PageEditor
          pageKey="contact"
          initialTitle={contactPage.title}
          fields={[
            { key: "email", label: "Contact email" },
            { key: "phone", label: "Contact phone" },
            { key: "whatsapp", label: "WhatsApp number" },
            { key: "address", label: "Address", textarea: true },
          ]}
          initialContent={contactPage.content}
        />
        <ContactInbox contacts={contacts} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------- Page editor
function PageEditor({
  pageKey,
  initialTitle,
  fields,
  initialContent,
}: {
  pageKey: string;
  initialTitle: string;
  fields: { key: string; label: string; textarea?: boolean }[];
  initialContent: Record<string, string>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState<Record<string, string>>(initialContent);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await saveCmsPageAction({ key: pageKey, title, content });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Page saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{pageKey} page content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Page title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.textarea ? (
              <Textarea
                value={content[f.key] ?? ""}
                onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                value={content[f.key] ?? ""}
                onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
        <Button onClick={save} disabled={pending} variant="primary">
          {pending ? "Saving…" : "Save page"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- FAQ manager
function FaqManager({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [open, setOpen] = useState(false);

  function startNew() {
    setEditing({ id: "", question: "", answer: "", category: "General", position: faqs.length, isPublished: true });
    setOpen(true);
  }

  async function remove(id: string) {
    const res = await deleteFaqAction(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("FAQ deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Frequently asked questions</CardTitle>
        <Button size="sm" variant="primary" onClick={startNew}>
          <Plus className="h-4 w-4" /> Add FAQ
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {faqs.length === 0 && <p className="text-sm text-fog-500">No FAQs yet.</p>}
        {faqs.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-ink-900/40 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{f.question}</p>
                {!f.isPublished && <Badge variant="outline">hidden</Badge>}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-fog-400">{f.answer}</p>
              <p className="mt-1 text-xs text-fog-600">{f.category}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {editing && <FaqDialog faq={editing} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function FaqDialog({ faq, open, onOpenChange }: { faq: Faq; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [form, setForm] = useState(faq);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await saveFaqAction({
        id: form.id || undefined,
        question: form.question,
        answer: form.answer,
        category: form.category,
        position: form.position,
        isPublished: form.isPublished,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("FAQ saved");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit FAQ" : "New FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Question">
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          </Field>
          <Field label="Answer">
            <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Position">
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-fog-300">
            <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
            Published
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Blog manager
function BlogManager({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Post | null>(null);
  const [open, setOpen] = useState(false);

  function startNew() {
    setEditing({ id: "", slug: "", title: "", excerpt: "", content: "", author: "RestoPanel", status: "DRAFT" });
    setOpen(true);
  }

  async function remove(id: string) {
    const res = await deleteBlogPostAction(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Post deleted");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Blog posts</CardTitle>
        <Button size="sm" variant="primary" onClick={startNew}>
          <Plus className="h-4 w-4" /> New post
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {posts.length === 0 && <p className="text-sm text-fog-500">No posts yet.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-ink-900/40 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{p.title}</p>
                <Badge variant={p.status === "PUBLISHED" ? "emerald" : "outline"}>{p.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-fog-600">/{p.slug} · {p.author}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {editing && <BlogDialog post={editing} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function BlogDialog({ post, open, onOpenChange }: { post: Post; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [form, setForm] = useState(post);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await saveBlogPostAction({
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        excerpt: form.excerpt ?? "",
        content: form.content,
        author: form.author,
        status: form.status,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Post saved");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit post" : "New post"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Slug">
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </Field>
          </div>
          <Field label="Excerpt">
            <Textarea value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          </Field>
          <Field label="Content">
            <Textarea className="min-h-40" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Author">
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-fog-300">
              <Switch
                checked={form.status === "PUBLISHED"}
                onCheckedChange={(v) => setForm({ ...form, status: v ? "PUBLISHED" : "DRAFT" })}
              />
              Published
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Contact inbox
function ContactInbox({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();

  async function toggle(id: string, isRead: boolean) {
    const res = await markContactReadAction(id, isRead);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Contact inbox</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contacts.length === 0 && <p className="text-sm text-fog-500">No messages.</p>}
        {contacts.map((c) => (
          <div
            key={c.id}
            className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
              c.isRead ? "border-line bg-ink-900/30" : "border-violet-500/25 bg-violet-500/5"
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {c.name} <span className="text-xs text-fog-500">{c.email}</span>
              </p>
              {c.restaurant && <p className="text-xs text-fog-600">{c.restaurant}</p>}
              <p className="mt-1 text-sm text-fog-300">{c.message}</p>
              <p className="mt-1 text-xs text-fog-600">{formatDateTime(c.createdAt)}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => toggle(c.id, !c.isRead)} aria-label="Toggle read">
              {c.isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4 text-violet-300" />}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
