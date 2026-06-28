"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { addCustomerNote, updateCustomerNote, deleteCustomerNote } from "./actions";

export interface CustomerNoteItem {
  id: string;
  body: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export function CustomerNotes({ customerId, notes }: { customerId: string; notes: CustomerNoteItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    if (!draft.trim()) return;
    setPending(true);
    try {
      const res = await addCustomerNote({ customerId, body: draft });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Note added");
      setDraft("");
      setAdding(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(id: string) {
    setPending(true);
    try {
      const res = await updateCustomerNote({ id, body: editBody });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Note updated");
      setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    try {
      const res = await deleteCustomerNote(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Note deleted");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a note about this customer…" autoFocus />
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={pending || !draft.trim()}>
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add note
        </Button>
      )}

      {notes.length === 0 && !adding ? (
        <p className="text-xs text-fog-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-line bg-ink-850 p-3">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(n.id)} disabled={pending || !editBody.trim()}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={pending}>
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-fog-200">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-fog-500">{formatDate(n.createdAt)}</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditingId(n.id); setEditBody(n.body); }}
                        aria-label="Edit note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => remove(n.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
