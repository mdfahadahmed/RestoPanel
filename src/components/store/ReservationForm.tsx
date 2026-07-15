"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createReservationPublic, getAvailableSlotsPublic } from "@/app/r/[slug]/actions";
import { localDateKey } from "@/lib/utils";

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
  const [reference, setReference] = useState("");

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  // Earliest selectable day = the user's local "today" (computed client-side to
  // reflect their timezone and avoid an SSR/CSR hydration mismatch).
  const [today, setToday] = useState("");
  useEffect(() => setToday(localDateKey()), []);

  // Load available slots whenever date or party size changes.
  useEffect(() => {
    if (!date) {
      setSlots([]); setSlotsLoaded(false); return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setTime("");
    const t = setTimeout(async () => {
      const res = await getAvailableSlotsPublic(slug, date, Number(partySize) || 1);
      if (cancelled) return;
      setSlots(res.ok ? res.data!.slots : []);
      setSlotsLoaded(true);
      setLoadingSlots(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slug, date, partySize]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) {
      toast.error("Please choose an available time");
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const res = await createReservationPublic(slug, { name, phone, email, date, time, partySize, notes });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setReference(res.data?.reference ?? "");
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
        {reference && (
          <p className="mt-3 text-sm text-fog-300">
            Your reference: <span className="font-mono font-semibold text-gold-300">{reference}</span>
          </p>
        )}
        <button
          onClick={() => {
            setDone(false); setReference("");
            setName(""); setPhone(""); setEmail(""); setDate(""); setTime(""); setPartySize("2"); setNotes("");
            setSlots([]); setSlotsLoaded(false);
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
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="store-input" />
        </Field>
      </div>

      {/* Time slots */}
      <div className="space-y-1.5">
        <label className="text-xs text-fog-400">Time</label>
        {!date ? (
          <p className="text-sm text-fog-500">Pick a date to see available times.</p>
        ) : loadingSlots ? (
          <p className="flex items-center gap-2 text-sm text-fog-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking availability…</p>
        ) : slots.length === 0 && slotsLoaded ? (
          <p className="text-sm text-amber-300/80">No availability for that date / party size. Try another day.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTime(s)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  time === s
                    ? "border-gold-300 bg-gold-400 text-ink-950"
                    : "border-line bg-ink-900 text-fog-200 hover:border-gold-300/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {err("time") && <p className="text-xs text-rose-400">{err("time")}</p>}
      </div>

      <Field label="Special requests (optional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="store-input" placeholder="High chair, window seat, dietary needs…" />
      </Field>

      <button
        type="submit"
        disabled={pending || !time}
        className="inline-flex w-full items-center justify-center rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Request reservation"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-fog-400">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
