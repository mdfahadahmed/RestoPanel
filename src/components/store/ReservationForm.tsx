"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { createReservationPublic } from "@/app/r/[slug]/actions";

type FieldErrors = Record<string, string[] | undefined>;

export function ReservationForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setPending(true);
    try {
      const res = await createReservationPublic(slug, { name, phone, email, date, time, partySize, notes });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Reservation requested");
      setDone(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-ink-900/50 p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h2 className="mt-4 text-xl font-semibold text-fog-50">Reservation requested</h2>
        <p className="mt-2 text-fog-400">
          Thanks {name || "there"}! We&apos;ve received your request and will confirm shortly.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setName(""); setPhone(""); setEmail(""); setDate(""); setTime(""); setPartySize("2"); setNotes("");
          }}
          className="mt-6 rounded-full border border-line bg-ink-900 px-5 py-2.5 text-sm text-fog-200 hover:bg-ink-800"
        >
          Make another reservation
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-ink-900/50 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={err("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="store-input" placeholder="Jane Doe" />
        </Field>
        <Field label="Phone" error={err("phone")}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="store-input" placeholder="07…" />
        </Field>
        <Field label="Email (optional)" error={err("email")}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="store-input" placeholder="you@email.com" />
        </Field>
        <Field label="Party size" error={err("partySize")}>
          <input type="number" min="1" max="50" value={partySize} onChange={(e) => setPartySize(e.target.value)} className="store-input" />
        </Field>
        <Field label="Date" error={err("date")}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="store-input" />
        </Field>
        <Field label="Time" error={err("time")}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="store-input" />
        </Field>
        <Field label="Special requests (optional)" full>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="store-input" placeholder="High chair, window seat, dietary needs…" />
        </Field>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Request reservation"}
      </button>
    </form>
  );
}

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <label className="text-xs text-fog-400">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
