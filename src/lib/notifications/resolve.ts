import type { NotificationChannel, NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDefaultTemplate, type ResolvedTemplate } from "./templates";

/**
 * The template to use for an event×channel, factoring in a restaurant override.
 * `isActive=false` means the channel is switched off and dispatch should skip it.
 * Returns null when there is no template at all for this combination.
 *
 * Kept separate from templates.ts (which is client-safe) because it touches the
 * database.
 */
export async function resolveTemplate(
  restaurantId: string,
  event: NotificationEvent,
  channel: NotificationChannel
): Promise<ResolvedTemplate | null> {
  const override = await prisma.notificationTemplate.findUnique({
    where: { restaurantId_event_channel: { restaurantId, event, channel } },
  });
  if (override) {
    return {
      subject: override.subject ?? undefined,
      body: override.body,
      isCustom: true,
      isActive: override.isActive,
    };
  }
  const def = getDefaultTemplate(event, channel);
  if (!def) return null;
  return { ...def, isCustom: false, isActive: true };
}
