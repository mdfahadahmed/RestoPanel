"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createQrAction } from "./actions";

type QrType = "MENU" | "TABLE" | "DYNAMIC";

export function CreateQrDialog({ logoAvailable }: { logoAvailable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [type, setType] = useState<QrType>("MENU");
  const [label, setLabel] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [isDynamic, setIsDynamic] = useState(false);
  const [logoEnabled, setLogoEnabled] = useState(true);

  function reset() {
    setType("MENU"); setLabel(""); setTableNumber(""); setTargetPath("");
    setIsDynamic(false); setLogoEnabled(true); setErrors({});
  }

  async function submit() {
    setPending(true);
    setErrors({});
    try {
      const res = await createQrAction({
        label,
        type,
        tableNumber: type === "TABLE" && tableNumber ? Number(tableNumber) : undefined,
        targetPath: type === "DYNAMIC" ? targetPath : undefined,
        isDynamic: type === "DYNAMIC" ? true : isDynamic,
        logoEnabled,
      });
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success("QR code created");
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus className="h-4 w-4" /> Create QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New QR code</DialogTitle>
          <DialogDescription>Generate a QR that opens your storefront.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qr-label">Label</Label>
            <Input id="qr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main menu, Table 5, Window flyer" />
            {errors.label && <p className="text-xs text-rose-400">{errors.label[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as QrType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MENU">Menu — opens your storefront</SelectItem>
                <SelectItem value="TABLE">Table — tags the order with a table</SelectItem>
                <SelectItem value="DYNAMIC">Dynamic — editable, trackable redirect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "TABLE" && (
            <div className="space-y-1.5">
              <Label htmlFor="qr-table">Table number</Label>
              <Input id="qr-table" type="number" min={1} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="5" />
              {errors.tableNumber && <p className="text-xs text-rose-400">{errors.tableNumber[0]}</p>}
            </div>
          )}

          {type === "DYNAMIC" && (
            <div className="space-y-1.5">
              <Label htmlFor="qr-target">Destination path</Label>
              <Input id="qr-target" value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="/r/your-slug/menu (leave blank for home)" />
              <p className="text-xs text-fog-500">You can change this anytime without reprinting the code.</p>
              {errors.targetPath && <p className="text-xs text-rose-400">{errors.targetPath[0]}</p>}
            </div>
          )}

          {type !== "DYNAMIC" && (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5">
              <span className="text-sm">
                <span className="font-medium text-fog-200">Trackable redirect</span>
                <span className="block text-xs text-fog-500">Count scans &amp; allow re-pointing later</span>
              </span>
              <Switch checked={isDynamic} onCheckedChange={setIsDynamic} />
            </label>
          )}

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium text-fog-200">Custom logo</span>
              <span className="block text-xs text-fog-500">
                {logoAvailable ? "Embed your restaurant logo in the center" : "Upload a logo in Settings to enable"}
              </span>
            </span>
            <Switch checked={logoEnabled && logoAvailable} onCheckedChange={setLogoEnabled} disabled={!logoAvailable} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={pending || !label.trim()}>
            {pending ? "Creating…" : "Create QR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
