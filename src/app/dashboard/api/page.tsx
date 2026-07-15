import Link from "next/link";
import { KeyRound, BookOpen } from "lucide-react";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenant } from "@/lib/tenant";
import { listApiKeys } from "@/lib/api/keys";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { CreateKeyDialog } from "./CreateKeyDialog";
import { KeyRowActions } from "./KeyRowActions";

export const dynamic = "force-dynamic";

function keyStatus(k: { isActive: boolean; revokedAt: Date | null; expiresAt: Date | null }) {
  if (k.revokedAt || !k.isActive) return { label: "revoked", variant: "rose" as const };
  if (k.expiresAt && k.expiresAt.getTime() < Date.now()) return { label: "expired", variant: "amber" as const };
  return { label: "active", variant: "emerald" as const };
}

export default async function ApiKeysPage() {
  const { restaurantId } = await requireTenant();
  const keys = await listApiKeys(restaurantId);

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="API"
        description="Programmatic access to your restaurant's data over the REST API."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <a href="/docs" target="_blank" rel="noreferrer"><BookOpen className="h-4 w-4" /> API docs</a>
            </Button>
            <CreateKeyDialog />
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-fog-400">
          <p>Authenticate with the <code className="rounded bg-ink-800 px-1 py-0.5 text-xs text-fog-200">Authorization: Bearer</code> header and call the versioned base URL:</p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-ink-900 p-3 text-xs text-fog-200">{`curl https://your-domain/api/v1/products \\
  -H "Authorization: Bearer rp_live_…"`}</pre>
          <p>Explore every endpoint in the <Link href="/docs" className="text-violet-400 hover:underline">interactive docs</Link>.</p>
        </CardContent>
      </Card>

      {/* API keys */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fog-200">API keys</h2>
          {keys.length > 0 && (
            <span className="text-xs text-fog-500">
              {keys.length} key{keys.length === 1 ? "" : "s"} · oldest {formatDate(keys[keys.length - 1].createdAt)}
            </span>
          )}
        </div>

        {keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a key to start calling the REST API. You'll choose scopes and a rate limit."
            action={<CreateKeyDialog />}
            className="px-6 py-10"
          />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Rate limit</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const status = keyStatus(k);
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs text-fog-400">{k.prefix}…{k.last4}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
                          ))}
                          {k.scopes.length > 3 && <Badge variant="outline">+{k.scopes.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-fog-400">{k.rateLimitPerMin}/min</TableCell>
                      <TableCell className="text-xs text-fog-400">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Never"}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <KeyRowActions id={k.id} name={k.name} active={status.label === "active"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </GsapReveal>
  );
}
