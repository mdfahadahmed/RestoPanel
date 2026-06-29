export interface SendResult {
  ok: boolean;
  /** Provider message id on success. */
  id?: string;
  error?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Display name for the From header (e.g. the restaurant name). */
  senderName?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}
