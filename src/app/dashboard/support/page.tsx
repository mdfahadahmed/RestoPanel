import Link from "next/link";
import { LifeBuoy, MessagesSquare } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { listTicketsForRestaurant } from "@/lib/support/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { NewTicketDialog } from "./NewTicketDialog";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "./ticket-meta";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { restaurantId } = await requireTenant();
  const { rows } = await listTicketsForRestaurant(restaurantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Get help from the RestoPanel team. Open a ticket and we'll reply by email and here."
        action={<NewTicketDialog />}
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-900/50 px-4 py-2 text-fog-200 transition hover:border-fog-600"
        >
          <LifeBuoy className="h-4 w-4 text-violet-300" /> Browse the Help Center
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-900/50 px-4 py-2 text-fog-200 transition hover:border-fog-600"
        >
          API docs
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No tickets yet"
          description="Have a question or hit a problem? Open a ticket and our team will help."
          action={<NewTicketDialog />}
        />
      ) : (
        <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-ink-900/40">
          {rows.map((t) => {
            const status = TICKET_STATUS_META[t.status];
            const priority = TICKET_PRIORITY_META[t.priority];
            return (
              <li key={t.id}>
                <Link
                  href={`/dashboard/support/${t.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-ink-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fog-100">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-fog-500">
                      {t._count.messages} message{t._count.messages === 1 ? "" : "s"} ·{" "}
                      <span className={priority.className}>{priority.label} priority</span> ·
                      Updated {formatDate(t.lastMessageAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
