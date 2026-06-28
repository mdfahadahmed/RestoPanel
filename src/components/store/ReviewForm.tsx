"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, CheckCircle2 } from "lucide-react";
import { createReviewPublic } from "@/app/r/[slug]/actions";

export function ReviewForm({ slug, orderNumber }: { slug: string; orderNumber: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Please pick a rating");
      return;
    }
    setPending(true);
    try {
      const res = await createReviewPublic(slug, { orderNumber, rating, comment, name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks for your review!");
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-ink-900/50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
        <p className="mt-2 font-medium text-fog-100">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-ink-900/50 p-6">
      <h2 className="font-semibold text-fog-100">Leave a review</h2>
      <div className="mt-3 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star className={`h-7 w-7 transition ${n <= (hover || rating) ? "fill-gold-400 text-gold-400" : "text-fog-700"}`} />
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name (optional)"
        aria-label="Your name"
        className="store-input mt-3"
        maxLength={120}
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Tell others about your experience (optional)"
        aria-label="Your review"
        className="store-input mt-3"
        maxLength={1000}
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-full bg-gold-400 px-6 py-2.5 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
