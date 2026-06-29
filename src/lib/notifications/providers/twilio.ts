import type { SmsConfig } from "../config";
import type { SmsMessage, SendResult } from "../types";

/**
 * Twilio SMS provider — REST API over `fetch` with Basic auth and form-encoding
 * (no SDK, no native deps). Builders are pure for testing.
 */

export function twilioEndpoint(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
}

export function buildTwilioForm(cfg: SmsConfig, msg: SmsMessage): string {
  const params = new URLSearchParams();
  params.set("From", cfg.fromNumber);
  params.set("To", msg.to);
  params.set("Body", msg.body);
  return params.toString();
}

function basicAuth(sid: string, token: string): string {
  // btoa is available in the Node 24 runtime these handlers run in.
  return "Basic " + btoa(`${sid}:${token}`);
}

export async function sendViaTwilio(
  cfg: SmsConfig,
  msg: SmsMessage,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  try {
    const res = await fetchImpl(twilioEndpoint(cfg.accountSid), {
      method: "POST",
      headers: {
        Authorization: basicAuth(cfg.accountSid, cfg.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildTwilioForm(cfg, msg),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message ?? `Twilio error (${res.status})` };
    }
    return { ok: true, id: json.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Twilio request failed" };
  }
}
