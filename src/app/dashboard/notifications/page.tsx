import { Bell, Mail, MessageSquare, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { ParamTabs } from "@/components/admin/ParamTabs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenant } from "@/lib/tenant";
import {
  listNotificationLogs,
  getNotificationStats,
  listResolvedTemplates,
} from "@/lib/notifications/data";
import { EVENT_META } from "@/lib/notifications/templates";
import { getEmailConfig, getSmsConfig } from "@/lib/notifications/config";
import { formatDateTime, formatNumber } from "@/lib/admin/format";
import { TemplateEditor } from "./TemplateEditor";
import { SendTestForm } from "./SendTestForm";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Sent", value: "SENT" },
  { label: "Skipped", value: "SKIPPED" },
  { label: "Failed", value: "FAILED" },
];
const CHANNEL_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Email", value: "EMAIL" },
  { label: "SMS", value: "SMS" },
];

function statusBadge(status: NotificationStatus) {
  switch (status) {
    case "SENT": return <Badge variant="emerald">sent</Badge>;
    case "FAILED": return <Badge variant="rose">failed</Badge>;
    case "SKIPPED": return <Badge variant="outline">skipped</Badge>;
    default: return <Badge variant="amber">queued</Badge>;
  }
}

function channelBadge(channel: NotificationChannel) {
  return channel === "EMAIL" ? (
    <Badge variant="violet"><Mail className="h-3 w-3" /> Email</Badge>
  ) : (
    <Badge variant="sky"><MessageSquare className="h-3 w-3" /> SMS</Badge>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; page?: string }>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [logsResult, stats, templates, emailCfg, smsCfg] = await Promise.all([
    listNotificationLogs(restaurantId, {
      status: (sp.status as NotificationStatus | "ALL") ?? "ALL",
      channel: (sp.channel as NotificationChannel | "ALL") ?? "ALL",
      page,
    }),
    getNotificationStats(restaurantId),
    listResolvedTemplates(restaurantId),
    getEmailConfig(),
    getSmsConfig(),
  ]);

  const { rows, total, pageCount, perPage } = logsResult;

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Order, reservation and welcome messages over email (Resend) and SMS (Twilio)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sent" value={formatNumber(stats.SENT)} icon={CheckCircle2} accent="text-emerald-300" />
        <StatCard label="Skipped" value={formatNumber(stats.SKIPPED)} icon={MinusCircle} />
        <StatCard label="Failed" value={formatNumber(stats.FAILED)} icon={XCircle} accent="text-rose-300" />
        <StatCard label="Total" value={formatNumber(stats.total)} icon={Bell} />
      </div>

      <Tabs defaultValue="activity">
        <TabsList className="flex-wrap">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        {/* Activity log */}
        <TabsContent value="activity" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ParamTabs paramKey="status" options={STATUS_OPTIONS} />
            <ParamTabs paramKey="channel" options={CHANNEL_OPTIONS} />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              description="Sent messages will appear here. Update an order's status or take a reservation to see one."
              className="min-h-[400px] py-10"
            />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-fog-400">{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell className="text-fog-200">{EVENT_META[log.event].label}</TableCell>
                      <TableCell>{channelBadge(log.channel)}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-fog-300">{log.recipient}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-fog-500">
                        {log.error ?? log.subject ?? log.body.slice(0, 60)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} totalPages={pageCount} totalItems={total} pageSize={perPage} />
            </Card>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates">
          <TemplateEditor templates={templates} />
        </TabsContent>

        {/* Providers */}
        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-fog-400" /> Email — Resend</CardTitle>
                <Badge variant={emailCfg ? "emerald" : "outline"}>{emailCfg ? "Connected" : "Not configured"}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-fog-400">
                {emailCfg ? `Sending from ${emailCfg.fromEmail}.` : "Add Resend credentials in platform settings to enable email."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-fog-400" /> SMS — Twilio</CardTitle>
                <Badge variant={smsCfg ? "emerald" : "outline"}>{smsCfg ? "Connected" : "Not configured"}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-fog-400">
                {smsCfg ? `Sending from ${smsCfg.fromNumber}.` : "Add Twilio credentials in platform settings to enable SMS."}
              </CardContent>
            </Card>
          </div>

          <SendTestForm emailReady={Boolean(emailCfg)} smsReady={Boolean(smsCfg)} />
        </TabsContent>
      </Tabs>
    </GsapReveal>
  );
}
