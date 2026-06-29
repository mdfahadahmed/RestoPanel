import type { NotificationChannel, NotificationEvent } from "@prisma/client";

/**
 * Reusable notification templates.
 *
 * Built-in defaults live here; a restaurant may override any event×channel via
 * the NotificationTemplate table (edited in the Notification Center). Bodies use
 * {{placeholder}} tokens interpolated from a per-event context at send time.
 */

export interface TemplateContent {
  subject?: string; // email only
  body: string;
}

export interface EventMeta {
  event: NotificationEvent;
  label: string;
  description: string;
  channels: NotificationChannel[];
  placeholders: string[];
}

export const EVENT_META: Record<NotificationEvent, EventMeta> = {
  ORDER_CONFIRMED: {
    event: "ORDER_CONFIRMED",
    label: "Order Confirmed",
    description: "Sent when an order is confirmed.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "orderNumber", "total", "trackUrl"],
  },
  ORDER_PREPARING: {
    event: "ORDER_PREPARING",
    label: "Preparing",
    description: "Sent when the kitchen starts preparing an order.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "orderNumber"],
  },
  ORDER_READY: {
    event: "ORDER_READY",
    label: "Ready",
    description: "Sent when an order is ready for pickup/delivery.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "orderNumber"],
  },
  ORDER_DELIVERED: {
    event: "ORDER_DELIVERED",
    label: "Delivered",
    description: "Sent when an order is delivered.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "orderNumber"],
  },
  RESERVATION: {
    event: "RESERVATION",
    label: "Reservation Received",
    description: "Sent when a customer requests a reservation.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "date", "partySize", "reference"],
  },
  RESERVATION_CONFIRMED: {
    event: "RESERVATION_CONFIRMED",
    label: "Reservation Approved",
    description: "Sent when a reservation is approved.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "date", "partySize", "reference", "tableName"],
  },
  RESERVATION_REJECTED: {
    event: "RESERVATION_REJECTED",
    label: "Reservation Declined",
    description: "Sent when a reservation is declined.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "date", "reason"],
  },
  RESERVATION_RESCHEDULED: {
    event: "RESERVATION_RESCHEDULED",
    label: "Reservation Rescheduled",
    description: "Sent when a reservation's date/time changes.",
    channels: ["EMAIL", "SMS"],
    placeholders: ["customerName", "restaurantName", "date", "partySize", "reference"],
  },
  WELCOME: {
    event: "WELCOME",
    label: "Welcome Email",
    description: "Sent to a new restaurant owner after signup.",
    channels: ["EMAIL"],
    placeholders: ["ownerName", "restaurantName", "dashboardUrl"],
  },
};

export const NOTIFICATION_EVENTS = Object.keys(EVENT_META) as NotificationEvent[];

type Defaults = Partial<Record<NotificationChannel, TemplateContent>>;

export const DEFAULT_TEMPLATES: Record<NotificationEvent, Defaults> = {
  ORDER_CONFIRMED: {
    EMAIL: {
      subject: "Order {{orderNumber}} confirmed — {{restaurantName}}",
      body:
        "Hi {{customerName}},\n\nThanks for your order! We've received order {{orderNumber}} " +
        "(total {{total}}) and it's now confirmed.\n\nTrack your order: {{trackUrl}}\n\n— {{restaurantName}}",
    },
    SMS: {
      body: "{{restaurantName}}: order {{orderNumber}} confirmed ({{total}}). Track: {{trackUrl}}",
    },
  },
  ORDER_PREPARING: {
    EMAIL: {
      subject: "Your order {{orderNumber}} is being prepared",
      body:
        "Hi {{customerName}},\n\nGood news — your order {{orderNumber}} is now being prepared.\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: order {{orderNumber}} is now being prepared." },
  },
  ORDER_READY: {
    EMAIL: {
      subject: "Your order {{orderNumber}} is ready",
      body: "Hi {{customerName}},\n\nYour order {{orderNumber}} is ready!\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: order {{orderNumber}} is ready." },
  },
  ORDER_DELIVERED: {
    EMAIL: {
      subject: "Your order {{orderNumber}} has been delivered",
      body:
        "Hi {{customerName}},\n\nYour order {{orderNumber}} has been delivered. Enjoy! " +
        "We'd love your feedback.\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: order {{orderNumber}} delivered. Enjoy!" },
  },
  RESERVATION: {
    EMAIL: {
      subject: "Reservation received — {{restaurantName}}",
      body:
        "Hi {{customerName}},\n\nWe've received your reservation request for {{partySize}} guest(s) " +
        "on {{date}} (ref {{reference}}). We'll confirm shortly.\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: reservation for {{partySize}} on {{date}} received (ref {{reference}})." },
  },
  RESERVATION_CONFIRMED: {
    EMAIL: {
      subject: "Your reservation is confirmed — {{restaurantName}}",
      body:
        "Hi {{customerName}},\n\nGreat news — your reservation for {{partySize}} guest(s) on {{date}} " +
        "is confirmed (ref {{reference}}). Table: {{tableName}}.\n\nWe look forward to seeing you!\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: your reservation on {{date}} is confirmed (ref {{reference}})." },
  },
  RESERVATION_REJECTED: {
    EMAIL: {
      subject: "About your reservation — {{restaurantName}}",
      body:
        "Hi {{customerName}},\n\nUnfortunately we can't accommodate your reservation on {{date}}. " +
        "{{reason}}\n\nPlease try another time — we'd love to host you.\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: sorry, we can't take your reservation on {{date}}. {{reason}}" },
  },
  RESERVATION_RESCHEDULED: {
    EMAIL: {
      subject: "Your reservation has moved — {{restaurantName}}",
      body:
        "Hi {{customerName}},\n\nYour reservation (ref {{reference}}) has been rescheduled to {{date}} " +
        "for {{partySize}} guest(s).\n\n— {{restaurantName}}",
    },
    SMS: { body: "{{restaurantName}}: your reservation (ref {{reference}}) is now {{date}}." },
  },
  WELCOME: {
    EMAIL: {
      subject: "Welcome to RestoPanel, {{restaurantName}}!",
      body:
        "Hi {{ownerName}},\n\nWelcome to RestoPanel! Your workspace for {{restaurantName}} is ready.\n\n" +
        "Open your dashboard: {{dashboardUrl}}\n\n— The RestoPanel Team",
    },
  },
};

export type TemplateContext = Record<string, string | number | null | undefined>;

/** Interpolate {{placeholders}} (whitespace-tolerant). Unknown tokens → "". */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

export function getDefaultTemplate(
  event: NotificationEvent,
  channel: NotificationChannel
): TemplateContent | undefined {
  return DEFAULT_TEMPLATES[event]?.[channel];
}

export interface ResolvedTemplate extends TemplateContent {
  isCustom: boolean;
  isActive: boolean;
}

/** Render a resolved template against a context (subject + body). */
export function renderResolved(template: TemplateContent, context: TemplateContext) {
  return {
    subject: template.subject ? renderTemplate(template.subject, context) : undefined,
    body: renderTemplate(template.body, context),
  };
}
