import type { Prisma, NotificationChannel, NotificationEvent, NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EVENT_META,
  NOTIFICATION_EVENTS,
  getDefaultTemplate,
} from "./templates";
import { resolveTemplate } from "./resolve";

/** Data access for the Notification Center UI (logs + template management). */

export async function listNotificationLogs(
  restaurantId: string,
  filters: {
    event?: NotificationEvent | "ALL";
    channel?: NotificationChannel | "ALL";
    status?: NotificationStatus | "ALL";
    page?: number;
    perPage?: number;
  } = {}
) {
  const { event = "ALL", channel = "ALL", status = "ALL", page = 1, perPage = 25 } = filters;
  const where: Prisma.NotificationLogWhereInput = { restaurantId };
  if (event !== "ALL") where.event = event;
  if (channel !== "ALL") where.channel = channel;
  if (status !== "ALL") where.status = status;

  const [total, rows] = await Promise.all([
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return { total, rows, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getNotificationStats(restaurantId: string) {
  const grouped = await prisma.notificationLog.groupBy({
    by: ["status"],
    where: { restaurantId },
    _count: true,
  });
  const counts: Record<NotificationStatus, number> = { QUEUED: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
  for (const g of grouped) counts[g.status] = g._count;
  const total = counts.QUEUED + counts.SENT + counts.FAILED + counts.SKIPPED;
  return { ...counts, total };
}

export interface ResolvedTemplateRow {
  event: NotificationEvent;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  isActive: boolean;
  isCustom: boolean;
}

/** Every event×channel with its effective template (default or override). */
export async function listResolvedTemplates(restaurantId: string): Promise<ResolvedTemplateRow[]> {
  const rows: ResolvedTemplateRow[] = [];
  for (const event of NOTIFICATION_EVENTS) {
    for (const channel of EVENT_META[event].channels) {
      const resolved = await resolveTemplate(restaurantId, event, channel);
      if (!resolved) continue;
      rows.push({
        event,
        channel,
        subject: resolved.subject ?? null,
        body: resolved.body,
        isActive: resolved.isActive,
        isCustom: resolved.isCustom,
      });
    }
  }
  return rows;
}

export async function saveTemplateOverride(input: {
  restaurantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  isActive?: boolean;
}) {
  const { restaurantId, event, channel } = input;
  return prisma.notificationTemplate.upsert({
    where: { restaurantId_event_channel: { restaurantId, event, channel } },
    create: {
      restaurantId,
      event,
      channel,
      subject: channel === "EMAIL" ? input.subject ?? null : null,
      body: input.body,
      isActive: input.isActive ?? true,
    },
    update: {
      subject: channel === "EMAIL" ? input.subject ?? null : null,
      body: input.body,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

/**
 * Toggle a channel on/off. Creating the override row (seeded from the default
 * template) when one doesn't exist yet, so disabling a default works.
 */
export async function setTemplateActive(input: {
  restaurantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  isActive: boolean;
}) {
  const { restaurantId, event, channel, isActive } = input;
  const def = getDefaultTemplate(event, channel);
  return prisma.notificationTemplate.upsert({
    where: { restaurantId_event_channel: { restaurantId, event, channel } },
    create: {
      restaurantId,
      event,
      channel,
      subject: channel === "EMAIL" ? def?.subject ?? null : null,
      body: def?.body ?? "",
      isActive,
    },
    update: { isActive },
  });
}

/** Remove a restaurant override → revert to the built-in default. */
export async function resetTemplate(
  restaurantId: string,
  event: NotificationEvent,
  channel: NotificationChannel
) {
  await prisma.notificationTemplate.deleteMany({
    where: { restaurantId, event, channel },
  });
}
