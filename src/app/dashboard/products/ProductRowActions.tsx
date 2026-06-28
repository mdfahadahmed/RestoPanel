"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { duplicateProduct, quickUpdateProduct, softDeleteProduct } from "./actions";

interface ProductRowActionsProps {
  product: { id: string; name: string; isAvailable: boolean; featured: boolean };
}

export function ProductRowActions({ product }: ProductRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function quick(patch: { isAvailable?: boolean; featured?: boolean }, msg: string) {
    const res = await quickUpdateProduct({ id: product.id, ...patch });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(msg);
    router.refresh();
  }

  async function handleDuplicate() {
    const res = await duplicateProduct(product.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Product duplicated as a draft");
    if (res.data?.id) router.push(`/dashboard/products/${res.data.id}/edit`);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    try {
      const res = await softDeleteProduct(product.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Product moved to trash");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Product actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/products/${product.id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void quick(
                { isAvailable: !product.isAvailable },
                product.isAvailable ? "Marked unavailable" : "Marked available"
              );
            }}
          >
            {product.isAvailable ? (
              <>
                <EyeOff className="h-4 w-4" /> Mark unavailable
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Mark available
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void quick(
                { featured: !product.featured },
                product.featured ? "Removed from featured" : "Marked as featured"
              );
            }}
          >
            <Star className="h-4 w-4" />
            {product.featured ? "Unfeature" : "Feature"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void handleDuplicate();
            }}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{product.name}”?</DialogTitle>
            <DialogDescription>
              The product will be moved to trash and hidden from your menu. You can
              restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
