"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  saveTemplateOverride,
  setTemplateActive,
  resetTemplate,
} from "@/lib/notifications/data";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { EVENT_META } from "@/lib/notifications/templates";

const channel = z.enum(["EMAIL", "SMS"]);
const event = z.enum([
  "ORDER_CONFIRMED",
  "ORDER_PREPARING",
  "ORDER_READY",
  "ORDER_DELIVERED",
  "RESERVATION",
  "WELCOME",
]);

const saveSchema = z.object({
  event,
  channel,
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Body is required").max(2000),
  isActive: z.boolean().optional(),
});

export async function saveTemplateAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  await saveTemplateOverride({ restaurantId, ...parsed.data });
  revalidatePath("/dashboard/notifications");
  return actionOk();
}

export async function toggleTemplateAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = z.object({ event, channel, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  await setTemplateActive({ restaurantId, ...parsed.data });
  revalidatePath("/dashboard/notifications");
  return actionOk();
}

export async function resetTemplateAction(input: unknown): Promise<ActionResult> {
  const { restaurantId } = await requireTenant();
  const parsed = z.object({ event, channel }).safeParse(input);
  if (!parsed.success) return actionError("Invalid request");
  await resetTemplate(restaurantId, parsed.data.event, parsed.data.channel);
  revalidatePath("/dashboard/notifications");
  return actionOk();
}

const testSchema = z.object({
  event,
  channel,
  recipient: z.string().trim().min(1, "Enter a recipient"),
});

/** Send a test notification to a chosen recipient using sample data. */
export async function sendTestAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const { restaurantId, restaurantName } = await requireTenant();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const { event: ev, channel: ch, recipient } = parsed.data;
  if (!EVENT_META[ev].channels.includes(ch)) {
    return actionError("That channel isn't available for this event");
  }

  const sample = {
    customerName: "Alex",
    ownerName: "Alex",
    restaurantName,
    orderNumber: "TEST-1001",
    total: "£24.50",
    trackUrl: "https://example.com/track/TEST-1001",
    date: "Sat 12 Jul, 19:30",
    partySize: 2,
    dashboardUrl: "https://example.com/dashboard",
  };

  const result = await dispatchNotification({
    restaurantId,
    event: ev,
    channel: ch,
    recipient,
    context: sample,
    senderName: restaurantName,
  });
  revalidatePath("/dashboard/notifications");
  return actionOk({ status: result.status });
}
