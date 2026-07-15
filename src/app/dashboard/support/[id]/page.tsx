import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Headset, UserRound } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { getTicketForRestaurant } from "@/lib/support/tenant";
import { formatDate } from "@/lib/utils";
import { TicketReplyForm } from "../TicketReplyForm";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "../ticket-meta";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { restaurantId } = await requireTenant();
  const { id } = await params;
  const ticket = await getTicketForRestaurant(restaurantId, id);
  if (!ticket) notFound();

  const status = TICKET_STATUS_META[ticket.status];
  const priority = TICKET_PRIORITY_META[ticket.priority];
  const closed = ticket.status === "CLOSED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/support"
        className="inline-flex items-center gap-1.5 text-sm text-fog-400 transition hover:text-fog-100"
      >
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fog-50">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-fog-500">
            Opened {formatDate(ticket.createdAt)} ·{" "}
            <span className={priority.className}>{priority.label} priority</span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => {
          const isOwner = m.authorType === "OWNER";
          return (
            <div
              key={m.id}
              className={`rounded-2xl border p-4 ${
                isOwner ? "border-line bg-ink-900/50" : "border-violet-500/25 bg-violet-500/5"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2 text-xs text-fog-500">
                {isOwner ? (
                  <UserRound className="h-3.5 w-3.5" />
                ) : (
                  <Headset className="h-3.5 w-3.5 text-violet-300" />
                )}
                <span className="font-medium text-fog-300">
                  {isOwner ? m.authorName : "RestoPanel Support"}
                </span>
                <span>· {formatDate(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fog-200">{m.body}</p>
            </div>
          );
        })}
      </div>

      {closed ? (
        <p className="rounded-xl border border-line bg-ink-900/40 px-4 py-3 text-center text-sm text-fog-500">
          This ticket is closed. Open a new one if you need more help.
        </p>
      ) : (
        <TicketReplyForm ticketId={ticket.id} />
      )}
    </div>
  );
}
