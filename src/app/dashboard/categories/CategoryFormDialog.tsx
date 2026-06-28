"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { createCategory, updateCategory } from "./actions";

export interface CategoryFormValues {
  id: string;
  name: string;
  isActive: boolean;
}

interface CategoryFormDialogProps {
  category?: CategoryFormValues; // present = edit mode
  trigger?: React.ReactNode; // uncontrolled mode
  open?: boolean; // controlled mode
  onOpenChange?: (open: boolean) => void;
}

export function CategoryFormDialog({
  category,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: CategoryFormDialogProps) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setInternalOpen(v));

  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reset fields whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setIsActive(category?.isActive ?? true);
      setError(null);
    }
  }, [open, category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setPending(true);
    try {
      const res = isEdit
        ? await updateCategory({ id: category!.id, name, isActive })
        : await createCategory({ name, isActive });

      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the category details."
              : "Group your menu items into a category."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Starters"
              autoFocus
              maxLength={80}
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line bg-ink-850 px-4 py-3">
            <div>
              <Label htmlFor="cat-active">Active</Label>
              <p className="text-xs text-fog-500">Visible on your ordering site</p>
            </div>
            <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
