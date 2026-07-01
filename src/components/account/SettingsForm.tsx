"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut } from "lucide-react";
import { toast } from "sonner";
import { updateSettings, signOutEverywhere } from "@/app/account/actions";

interface SettingsFormProps {
  language: string;
  theme: string;
  notifyOrderUpdates: boolean;
  notifyPromotions: boolean;
  notifyRestaurantMsgs: boolean;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
];

export function SettingsForm(props: SettingsFormProps) {
  const router = useRouter();
  const [theme, setTheme] = useState(props.theme === "light" ? "light" : "dark");
  const [language, setLanguage] = useState(props.language);
  const [orderUpdates, setOrderUpdates] = useState(props.notifyOrderUpdates);
  const [promotions, setPromotions] = useState(props.notifyPromotions);
  const [restaurantMsgs, setRestaurantMsgs] = useState(props.notifyRestaurantMsgs);
  const [saving, startSaving] = useTransition();
  const [signingOut, startSignOut] = useTransition();

  function applyThemeLive(next: "dark" | "light") {
    setTheme(next);
    const root = document.getElementById("account-root");
    if (root) root.classList.toggle("account-light", next === "light");
  }

  function save() {
    startSaving(async () => {
      const res = await updateSettings({
        language,
        theme,
        notifyOrderUpdates: orderUpdates,
        notifyPromotions: promotions,
        notifyRestaurantMsgs: restaurantMsgs,
      });
      if (res.ok) {
        toast.success("Settings saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onSignOutEverywhere() {
    startSignOut(async () => {
      await signOutEverywhere();
      toast.success("Signed out of all devices");
      router.replace("/account/login");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Appearance */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <h2 className="text-sm font-semibold text-fog-100">Appearance</h2>
        <p className="mt-1 text-xs text-fog-500">Choose how your account panel looks.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => applyThemeLive("dark")}
            aria-pressed={theme === "dark"}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition ${
              theme === "dark"
                ? "border-violet-500/60 bg-violet-500/10 text-fog-100"
                : "border-line bg-ink-900 text-fog-400 hover:bg-ink-800"
            }`}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
          <button
            type="button"
            onClick={() => applyThemeLive("light")}
            aria-pressed={theme === "light"}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition ${
              theme === "light"
                ? "border-violet-500/60 bg-violet-500/10 text-fog-100"
                : "border-line bg-ink-900 text-fog-400 hover:bg-ink-800"
            }`}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <h2 className="text-sm font-semibold text-fog-100">Language</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
          className="mt-3 w-full max-w-xs rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-sm text-fog-200 outline-none transition focus:border-violet-500/60"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </section>

      {/* Notification preferences */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <h2 className="text-sm font-semibold text-fog-100">Notification preferences</h2>
        <div className="mt-4 space-y-1">
          <Toggle
            label="Order updates"
            description="Status changes for your orders (confirmed, ready, delivered)."
            checked={orderUpdates}
            onChange={setOrderUpdates}
          />
          <Toggle
            label="Promotions"
            description="Deals and offers from restaurants you order from."
            checked={promotions}
            onChange={setPromotions}
          />
          <Toggle
            label="Restaurant messages"
            description="Direct messages from restaurants about your orders."
            checked={restaurantMsgs}
            onChange={setRestaurantMsgs}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-glow rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      {/* Security */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <h2 className="text-sm font-semibold text-fog-100">Security</h2>
        <p className="mt-1 text-xs text-fog-500">
          Signs you out of every device, including this one.
        </p>
        <button
          type="button"
          onClick={onSignOutEverywhere}
          disabled={signingOut}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out of all devices"}
        </button>
      </section>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
      <div>
        <p className="text-sm text-fog-200">{label}</p>
        <p className="text-xs text-fog-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-violet-500" : "bg-ink-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
