"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/staff/permissions";
import { createStaffMember, updateStaffMember } from "./actions";
import type { StaffMember } from "./StaffBoard";

interface StaffFormDialogProps {
  open: boolean;
  onClose: () => void;
  member: StaffMember | null; // null = create
}

export function StaffFormDialog({ open, onClose, member }: StaffFormDialogProps) {
  const router = useRouter();
  const editing = member !== null;
  const isOwner = member?.role === "OWNER";

  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [role, setRole] = useState<string>(member && member.role !== "OWNER" ? member.role : "CASHIER");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = editing
      ? await updateStaffMember({
          userId: member!.id,
          name,
          phone,
          ...(isOwner ? {} : { role, isActive }),
          ...(password ? { password } : {}),
        })
      : await createStaffMember({ name, email, phone, role, password });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Staff updated" : "Staff added");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit staff member" : "Add staff member"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this person's details, role and access." : "Create a login for a team member."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sf-name">Name</Label>
            <Input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-email">Email</Label>
            <Input
              id="sf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={editing}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sf-phone">Phone</Label>
              <Input id="sf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {!isOwner && (
              <div className="space-y-1.5">
                <Label htmlFor="sf-role">Role</Label>
                <select
                  id="sf-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-ink-800/70 px-3 text-sm text-fog-100"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-pass">{editing ? "New password (optional)" : "Password"}</Label>
            <Input
              id="sf-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"}
            />
          </div>
          {editing && !isOwner && (
            <label className="flex items-center gap-2 text-sm text-fog-200">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded border-line bg-ink-800"
              />
              Active (can sign in & be scheduled)
            </label>
          )}
        </div>

        <Button variant="primary" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add staff"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
