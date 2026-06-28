"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreProduct } from "./actions";

export function RestoreProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle() {
    setPending(true);
    try {
      const res = await restoreProduct(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Product restored");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={pending}>
      <RotateCcw className="h-3.5 w-3.5" /> {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
