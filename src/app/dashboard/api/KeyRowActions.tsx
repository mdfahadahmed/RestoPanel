"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { revokeApiKeyAction, deleteApiKeyAction } from "./actions";

export function KeyRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function revoke() {
    setBusy(true);
    try {
      const res = await revokeApiKeyAction(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Key revoked");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await deleteApiKeyAction(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Key deleted");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Key actions" disabled={busy}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {active && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); revoke(); }}>
              <Ban className="h-4 w-4" /> Revoke
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{name}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-fog-400">Any integration using this key will immediately stop working. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
