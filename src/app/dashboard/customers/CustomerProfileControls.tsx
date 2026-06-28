"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "@/app/dashboard/products/TagsInput";
import type { CustomerStatus } from "@/lib/validations/customer";
import { setCustomerStatus, setCustomerTags } from "./actions";

export function CustomerStatusControl({ id, status }: { id: string; status: CustomerStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(value: CustomerStatus) {
    setPending(true);
    try {
      const res = await setCustomerStatus({ id, status: value });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked ${value.toLowerCase()}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={status} onValueChange={(v) => change(v as CustomerStatus)} disabled={pending}>
      <SelectTrigger className="h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACTIVE">Active</SelectItem>
        <SelectItem value="INACTIVE">Inactive</SelectItem>
        <SelectItem value="BLOCKED">Blocked</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function CustomerTagsControl({ id, tags }: { id: string; tags: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState<string[]>(tags);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(tags);

  async function save() {
    setPending(true);
    try {
      const res = await setCustomerTags({ id, tags: value });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tags updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <TagsInput value={value} onChange={setValue} placeholder="Regular, Corporate…" />
      {dirty && (
        <Button size="sm" variant="outline" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save tags"}
        </Button>
      )}
    </div>
  );
}
