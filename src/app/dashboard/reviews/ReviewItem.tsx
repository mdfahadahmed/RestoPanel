"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Star, Eye, EyeOff, Trash2, Reply, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { replyToReview, toggleReviewVisibility, deleteReview } from "./actions";

export interface ReviewItemData {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: string;
  isPublished: boolean;
  orderId: string | null;
  orderNumber: string | null;
}

export function ReviewItem({ review }: { review: ReviewItemData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [replyText, setReplyText] = useState(review.reply ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function saveReply() {
    setPending(true);
    try {
      const res = await replyToReview({ id: review.id, reply: replyText });
      if (!res.ok) return toast.error(res.error);
      toast.success(replyText.trim() ? "Reply saved" : "Reply removed");
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleVisibility() {
    setPending(true);
    try {
      const res = await toggleReviewVisibility({ id: review.id, isPublished: !review.isPublished });
      if (!res.ok) return toast.error(res.error);
      toast.success(review.isPublished ? "Review hidden" : "Review published");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      const res = await deleteReview(review.id);
      if (!res.ok) return toast.error(res.error);
      toast.success("Review deleted");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-gold-400 text-gold-400" : "text-fog-700"}`} />
              ))}
            </div>
            {!review.isPublished && <Badge variant="outline">Hidden</Badge>}
          </div>
          <p className="mt-2 text-sm font-medium text-fog-100">{review.customerName}</p>
          <div className="flex items-center gap-2 text-xs text-fog-500">
            <span>{formatDate(review.createdAt)}</span>
            {review.orderNumber && (
              <Link href={`/dashboard/orders/${review.orderId}`} className="text-violet-300 hover:text-violet-200">
                Order #{review.orderNumber}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleVisibility} disabled={pending} aria-label={review.isPublished ? "Hide review" : "Publish review"}>
            {review.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)} disabled={pending} aria-label="Delete review">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {review.comment && <p className="mt-3 text-sm text-fog-300">“{review.comment}”</p>}

      {/* Reply */}
      <div className="mt-4 rounded-xl border border-line bg-ink-850 p-3">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Write a public reply…" autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveReply} disabled={pending}><Check className="h-3.5 w-3.5" /> Save reply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setReplyText(review.reply ?? ""); }} disabled={pending}><X className="h-3.5 w-3.5" /> Cancel</Button>
            </div>
          </div>
        ) : review.reply ? (
          <div>
            <p className="text-xs font-medium text-gold-300">Your reply</p>
            <p className="mt-1 text-sm text-fog-300">{review.reply}</p>
            <Button size="sm" variant="ghost" className="mt-1 px-0 text-fog-400" onClick={() => setEditing(true)}>
              <Reply className="h-3.5 w-3.5" /> Edit reply
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="px-0 text-fog-400" onClick={() => setEditing(true)}>
            <Reply className="h-3.5 w-3.5" /> Reply
          </Button>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete review?</DialogTitle>
            <DialogDescription>This permanently removes the review. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
