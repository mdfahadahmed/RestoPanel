import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pick a sensible locale per currency so the symbol/format matches the region
// (e.g. USD → "$", CAD → "CA$", GBP → "£"). RestoPanel targets UK/US/Canada.
const CURRENCY_LOCALES: Record<string, string> = {
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-CA",
  EUR: "en-IE",
  AUD: "en-AU",
};

/** The locale that renders a currency the way its region expects. */
export function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALES[currency?.toUpperCase()] ?? "en-GB";
}

/**
 * Format a number as a currency string. Defaults to GBP but, crucially, derives
 * the locale from the currency when one isn't given — so a USD/CAD storefront
 * renders "$"/"CA$" instead of "£". Always pass the restaurant's currency for
 * customer-facing prices.
 */
export function formatCurrency(value: number, currency = "GBP", locale?: string) {
  return new Intl.NumberFormat(locale ?? localeForCurrency(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format an ISO date / Date as a short readable string. */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(d);
}
