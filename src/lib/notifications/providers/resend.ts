import type { EmailConfig } from "../config";
import type { EmailMessage, SendResult } from "../types";

/**
 * Resend email provider — talked to over its REST API with `fetch` (no SDK, no
 * native deps). The payload builder is pure for testing.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

/** Compose the From header, preferring a per-message sender (the restaurant). */
export function formatFrom(cfg: EmailConfig, senderName?: string): string {
  const name = (senderName?.trim() || cfg.fromName || "").trim();
  return name ? `${name} <${cfg.fromEmail}>` : cfg.fromEmail;
}

export function buildResendPayload(cfg: EmailConfig, msg: EmailMessage): ResendPayload {
  return {
    from: formatFrom(cfg, msg.senderName),
    to: [msg.to],
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
  };
}

export async function sendViaResend(
  cfg: EmailConfig,
  msg: EmailMessage,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildResendPayload(cfg, msg)),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message ?? `Resend error (${res.status})` };
    }
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resend request failed" };
  }
}
