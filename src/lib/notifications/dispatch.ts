import type {
  NotificationChannel,
  NotificationEvent,
  NotificationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderResolved, type TemplateContext } from "./templates";
import { resolveTemplate } from "./resolve";
import { getEmailConfig, getSmsConfig } from "./config";
import { sendViaResend } from "./providers/resend";
import { sendViaTwilio } from "./providers/twilio";

/**
 * Render + send a single notification and record the attempt in NotificationLog.
 * Never performs a network call when the channel's provider is unconfigured —
 * it logs the attempt as SKIPPED instead, so the system is fully functional
 * (and testable) offline.
 */

export interface DispatchInput {
  restaurantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient?: string | null;
  context: TemplateContext;
  /** From display name for email (typically the restaurant name). */
  senderName?: string;
}

export interface DispatchResult {
  status: NotificationStatus;
  provider: string;
  logId: string;
  error?: string;
}

function channelProvider(channel: NotificationChannel): string {
  return channel === "EMAIL" ? "resend" : "twilio";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  return (
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">` +
    escapeHtml(text).replace(/\n/g, "<br/>") +
    `</div>`
  );
}

async function record(input: {
  restaurantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  provider: string;
  recipient: string;
  subject?: string;
  body: string;
  status: NotificationStatus;
  error?: string;
  providerMessageId?: string;
}): Promise<DispatchResult> {
  const row = await prisma.notificationLog.create({
    data: {
      restaurantId: input.restaurantId,
      event: input.event,
      channel: input.channel,
      provider: input.provider,
      recipient: input.recipient,
      subject: input.subject ?? null,
      body: input.body,
      status: input.status,
      error: input.error ?? null,
      providerMessageId: input.providerMessageId ?? null,
    },
    select: { id: true },
  });
  return { status: input.status, provider: input.provider, logId: row.id, error: input.error };
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const { restaurantId, event, channel } = input;
  const recipient = input.recipient?.trim() ?? "";
  const provider = channelProvider(channel);

  const template = await resolveTemplate(restaurantId, event, channel);
  if (!template) {
    return record({ restaurantId, event, channel, provider: "log", recipient, body: "", status: "SKIPPED", error: "No template for this channel" });
  }

  const rendered = renderResolved(template, input.context);

  if (!template.isActive) {
    return record({ restaurantId, event, channel, provider, recipient, subject: rendered.subject, body: rendered.body, status: "SKIPPED", error: "Channel disabled" });
  }
  if (!recipient) {
    return record({ restaurantId, event, channel, provider, recipient: "—", subject: rendered.subject, body: rendered.body, status: "SKIPPED", error: "No recipient" });
  }

  if (channel === "EMAIL") {
    const cfg = await getEmailConfig();
    if (!cfg) {
      return record({ restaurantId, event, channel, provider, recipient, subject: rendered.subject, body: rendered.body, status: "SKIPPED", error: "Email provider not configured" });
    }
    const result = await sendViaResend(cfg, {
      to: recipient,
      subject: rendered.subject ?? "",
      text: rendered.body,
      html: textToHtml(rendered.body),
      senderName: input.senderName,
    });
    return record({
      restaurantId, event, channel, provider, recipient,
      subject: rendered.subject, body: rendered.body,
      status: result.ok ? "SENT" : "FAILED",
      error: result.error, providerMessageId: result.id,
    });
  }

  // SMS
  const cfg = await getSmsConfig();
  if (!cfg) {
    return record({ restaurantId, event, channel, provider, recipient, body: rendered.body, status: "SKIPPED", error: "SMS provider not configured" });
  }
  const result = await sendViaTwilio(cfg, { to: recipient, body: rendered.body });
  return record({
    restaurantId, event, channel, provider, recipient,
    body: rendered.body,
    status: result.ok ? "SENT" : "FAILED",
    error: result.error, providerMessageId: result.id,
  });
}
