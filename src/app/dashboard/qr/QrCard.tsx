"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Printer,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQrSvgAction, toggleQrAction, deleteQrAction, updateQrAction } from "./actions";
import { downloadSvg, downloadPng, printSvg } from "./download";

export interface QrCardData {
  id: string;
  label: string;
  type: "MENU" | "TABLE" | "DYNAMIC";
  code: string;
  tableNumber: number | null;
  targetPath: string | null;
  isDynamic: boolean;
  isActive: boolean;
  scanCount: number;
  encodedUrl: string;
  targetUrl: string;
  previewSvg: string;
}

const TYPE_BADGE: Record<QrCardData["type"], { label: string; variant: "violet" | "sky" | "gold" }> = {
  MENU: { label: "Menu", variant: "violet" },
  TABLE: { label: "Table", variant: "sky" },
  DYNAMIC: { label: "Dynamic", variant: "gold" },
};

export function QrCard({ qr }: { qr: QrCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function withSvg(action: (svg: string, filename: string) => void | Promise<void>, key: string) {
    setBusy(key);
    try {
      const res = await getQrSvgAction(qr.id, { size: 1024 });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not render QR" : res.error);
        return;
      }
      await action(res.data.svg, res.data.filename);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qr.encodedUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function toggleActive(next: boolean) {
    setBusy("toggle");
    try {
      const res = await toggleQrAction(qr.id, next);
      if (!res.ok) { toast.error(res.error); return; }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const res = await deleteQrAction(qr.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("QR code deleted");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const badge = TYPE_BADGE[qr.type];

  return (
    <Card className={qr.isActive ? "" : "opacity-60"}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{qr.label}</p>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-fog-500">
              {qr.type === "TABLE" && qr.tableNumber != null ? `Table ${qr.tableNumber} · ` : ""}
              {qr.scanCount} scan{qr.scanCount === 1 ? "" : "s"}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="QR actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditOpen(true); }}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}>
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Preview */}
        <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-line bg-white p-3">
          <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.previewSvg }} />
        </div>

        {/* Encoded link */}
        <button
          onClick={copyLink}
          className="flex w-full items-center gap-2 rounded-lg border border-line bg-ink-900/40 px-2.5 py-1.5 text-left text-xs text-fog-400 transition hover:text-fog-200"
          title="Copy link"
        >
          <Copy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{qr.encodedUrl}</span>
        </button>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => withSvg((svg, f) => downloadSvg(svg, f), "svg")}>
            <Download className="h-4 w-4" /> SVG
          </Button>
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => withSvg((svg, f) => downloadPng(svg, f, 1024), "png")}>
            <ImageIcon className="h-4 w-4" /> PNG
          </Button>
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => withSvg((svg) => printSvg(svg, qr.label), "print")}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        <label className="flex items-center justify-between gap-2 pt-1 text-xs text-fog-400">
          <span>{qr.isActive ? "Active" : "Disabled"}</span>
          <Switch checked={qr.isActive} onCheckedChange={toggleActive} disabled={busy !== null} />
        </label>
      </CardContent>

      <EditQrDialog qr={qr} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{qr.label}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-fog-400">
            Any printed copies of this code will stop working. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EditQrDialog({ qr, open, onOpenChange }: { qr: QrCardData; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [label, setLabel] = useState(qr.label);
  const [tableNumber, setTableNumber] = useState(qr.tableNumber?.toString() ?? "");
  const [targetPath, setTargetPath] = useState(qr.targetPath ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await updateQrAction({
        id: qr.id,
        label,
        tableNumber: qr.type === "TABLE" && tableNumber ? Number(tableNumber) : undefined,
        targetPath: qr.type === "DYNAMIC" ? targetPath : undefined,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("QR code updated");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit QR code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`label-${qr.id}`}>Label</Label>
            <Input id={`label-${qr.id}`} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {qr.type === "TABLE" && (
            <div className="space-y-1.5">
              <Label htmlFor={`table-${qr.id}`}>Table number</Label>
              <Input id={`table-${qr.id}`} type="number" min={1} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
            </div>
          )}
          {qr.type === "DYNAMIC" && (
            <div className="space-y-1.5">
              <Label htmlFor={`target-${qr.id}`}>Destination path</Label>
              <Input id={`target-${qr.id}`} value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="/r/your-slug/menu" />
              <p className="text-xs text-fog-500">Re-point this code without reprinting it.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={pending || !label.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
