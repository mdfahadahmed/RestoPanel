"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Copy, Check, KeyRound, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_SCOPES, SCOPE_DESCRIPTIONS, type ApiScope } from "@/lib/api/scopes";
import { createApiKeyAction } from "./actions";

export function CreateKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("60");
  const [scopes, setScopes] = useState<ApiScope[]>(["products:read", "orders:read"]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(s: ApiScope) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function reset() {
    setName(""); setRate("60"); setScopes(["products:read", "orders:read"]);
    setErrors({}); setSecret(null); setCopied(false);
  }

  async function create() {
    setPending(true);
    setErrors({});
    try {
      const res = await createApiKeyAction({ name, scopes, rateLimitPerMin: Number(rate) });
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      setSecret(res.data!.plaintext);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret).catch(() => undefined);
    setCopied(true);
    toast.success("Key copied");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="primary"><Plus className="h-4 w-4" /> Create key</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Your new API key</DialogTitle>
              <DialogDescription>Copy it now — for security it won&apos;t be shown again.</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
              Store this secret somewhere safe. Anyone with it can call your API.
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 p-2.5">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-fog-100">{secret}</code>
              <Button size="icon" variant="outline" onClick={copy} aria-label="Copy">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>Grant scoped access to your restaurant&apos;s data.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile app, Zapier" />
                {errors.name && <p className="text-xs text-rose-400">{errors.name[0]}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Scopes</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {API_SCOPES.map((s) => (
                    <label key={s} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-ink-900/40 px-2.5 py-2">
                      <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="mt-0.5 accent-violet-500" />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-fog-200">{s}</span>
                        <span className="block text-[11px] text-fog-500">{SCOPE_DESCRIPTIONS[s]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.scopes && <p className="text-xs text-rose-400">{errors.scopes[0]}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key-rate">Rate limit (requests / minute)</Label>
                <Input id="key-rate" type="number" min={1} max={6000} value={rate} onChange={(e) => setRate(e.target.value)} className="w-40" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button variant="primary" onClick={create} disabled={pending || !name.trim() || scopes.length === 0}>
                {pending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
