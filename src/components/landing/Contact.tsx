"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";

// Configure these for your business (also surfaced in CLAUDE.md).
const WHATSAPP_NUMBER = "447700900000"; // international format, no "+"
const CONTACT_EMAIL = "hello@restopanel.com";
const DEMO_URL = "https://cal.com/restopanel/demo";

export function Contact() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const data = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      restaurant: String(form.get("restaurant") ?? ""),
      message: String(form.get("message") ?? ""),
    };
    if (!data.name || !data.email || !data.message) {
      setError("Please fill in your name, email and message.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setError("Could not send your message. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-line bg-mesh">
        <div className="grid gap-0 lg:grid-cols-2">
          {/* Left: pitch + channels */}
          <div className="border-b border-line p-8 sm:p-10 lg:border-b-0 lg:border-r">
            <Reveal>
              <span className="inline-block rounded-full border border-line bg-ink-900/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-violet-300">
                Contact
              </span>
            </Reveal>
            <Reveal index={1}>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Let&apos;s get your restaurant online
              </h2>
            </Reveal>
            <Reveal index={2}>
              <p className="mt-3 max-w-md text-sm text-fog-400">
                Talk to us about migrating your menu, custom domains or a
                multi-location rollout. We typically reply within a few hours.
              </p>
            </Reveal>

            <div className="mt-8 space-y-3">
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-glow flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
              >
                Book a demo <span>→</span>
              </a>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-900/60 px-4 py-3 text-sm font-medium text-fog-200 transition hover:border-emerald-400/40"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-900/60 px-4 py-3 text-sm font-medium text-fog-200 transition hover:border-violet-500/40"
                >
                  ✉️ Email
                </a>
              </div>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-900/60 px-4 py-3 text-sm font-medium text-fog-200 transition hover:border-gold-400/40"
              >
                📅 Schedule a call
              </a>
            </div>
          </div>

          {/* Right: form */}
          <div className="p-8 sm:p-10">
            {sent ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-xl text-emerald-300">
                  ✓
                </div>
                <h3 className="mt-4 text-lg font-semibold">Message sent</h3>
                <p className="mt-1 text-sm text-fog-400">
                  Thanks — we&apos;ll be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="name" label="Name" placeholder="Jane Smith" required />
                  <Field
                    name="restaurant"
                    label="Restaurant"
                    placeholder="Bella Tavola"
                  />
                </div>
                <Field
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="owner@restaurant.com"
                  required
                />
                <div className="space-y-1.5">
                  <label htmlFor="message" className="block text-sm font-medium text-fog-300">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell us about your restaurant…"
                    className="w-full rounded-xl border border-line bg-ink-800/70 px-3.5 py-2.5 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
                    required
                  />
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-glow w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-fog-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="w-full rounded-xl border border-line bg-ink-800/70 px-3.5 py-2.5 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
        {...props}
      />
    </div>
  );
}
