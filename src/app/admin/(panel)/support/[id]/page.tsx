import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTicket } from "@/lib/admin/support";
import {
  formatDateTime,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/admin/format";
import { TicketStatusControl, TicketReply } from "./TicketControls";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  return (
    <>
      <Link href="/admin/support" className="inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-fog-200">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.requesterName} · ${ticket.requesterEmail}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={ticketPriorityVariant(ticket.priority)}>{ticket.priority.toLowerCase()}</Badge>
            <Badge variant={ticketStatusVariant(ticket.status)}>{ticket.status.toLowerCase()}</Badge>
            <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
          </div>
        }
      />

      {ticket.restaurant && (
        <p className="text-sm text-fog-500">
          Restaurant:{" "}
          <Link href={`/admin/restaurants/${ticket.restaurant.id}`} className="text-violet-300 hover:underline">
            {ticket.restaurant.name}
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ticket.messages.map((m) => {
            const isAdmin = m.authorType === "ADMIN";
            return (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl border p-3 ${
                  isAdmin
                    ? "ml-auto border-violet-500/25 bg-violet-500/10"
                    : "border-line bg-ink-900/50"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-fog-500">
                  <span className="font-medium text-fog-300">{m.authorName}</span>
                  <span>·</span>
                  <span>{formatDateTime(m.createdAt)}</span>
                  {isAdmin && <Badge variant="violet">staff</Badge>}
                </div>
                <p className="whitespace-pre-wrap text-sm text-fog-200">{m.body}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketReply ticketId={ticket.id} />
        </CardContent>
      </Card>
    </>
  );
}
