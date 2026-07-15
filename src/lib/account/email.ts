import { getEmailConfig } from "@/lib/notifications/config";
import { sendViaResend } from "@/lib/notifications/providers/resend";
import type { SendResult } from "@/lib/notifications/types";

/**
 * Platform-level (not tenant-scoped) transactional email for customer accounts,
 * e.g. password resets. Mirrors the Notification Center's graceful-degradation
 * contract: when no email provider is configured we return `{ ok: false,
 * skipped: true }` instead of throwing, so the surrounding flow still succeeds
 * offline / in tests. Never surface provider errors to the end user.
 */
export interface PlatformEmailResult extends SendResult {
  skipped?: boolean;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<PlatformEmailResult> {
  const cfg = await getEmailConfig();
  if (!cfg) {
    // No provider configured — log for local visibility and skip the send.
    console.info(`[account] password reset link for ${params.to}: ${params.resetUrl}`);
    return { ok: false, skipped: true };
  }

  const subject = "Reset your RestoPanel password";
  const text = [
    `Hi ${params.name},`,
    "",
    "We received a request to reset the password for your RestoPanel account.",
    "Use the link below to choose a new password. It expires in one hour.",
    "",
    params.resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 16px">We received a request to reset the password for your RestoPanel account. This link expires in one hour.</p>
      <p style="margin:0 0 24px">
        <a href="${params.resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Choose a new password</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#666">Or paste this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${params.resetUrl}">${escapeHtml(params.resetUrl)}</a></p>
      <p style="margin:0;font-size:13px;color:#666">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`;

  return sendViaResend(cfg, { to: params.to, subject, text, html });
}

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<PlatformEmailResult> {
  const cfg = await getEmailConfig();
  if (!cfg) {
    console.info(`[account] email verification link for ${params.to}: ${params.verifyUrl}`);
    return { ok: false, skipped: true };
  }

  const subject = "Verify your RestoPanel email";
  const text = [
    `Hi ${params.name},`,
    "",
    "Please confirm your email address to secure your RestoPanel account.",
    "Click the link below — it expires in 24 hours.",
    "",
    params.verifyUrl,
    "",
    "If you didn't create this account, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 16px">Please confirm your email address to secure your RestoPanel account. This link expires in 24 hours.</p>
      <p style="margin:0 0 24px">
        <a href="${params.verifyUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Verify email</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#666">Or paste this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${params.verifyUrl}">${escapeHtml(params.verifyUrl)}</a></p>
      <p style="margin:0;font-size:13px;color:#666">If you didn't create this account, you can safely ignore this email.</p>
    </div>`;

  return sendViaResend(cfg, { to: params.to, subject, text, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
