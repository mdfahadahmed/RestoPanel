"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Eye, UserCheck, UserX, Ban, Trash2 } from "lucide-react";
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
import type { CustomerStatus } from "@/lib/validations/customer";
import { CustomerFormDialog, type CustomerFormValues } from "./CustomerFormDialog";
import { deleteCustomer, setCustomerStatus } from "./actions";

export function CustomerRowActions({ customer }: { customer: CustomerFormValues }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function changeStatus(status: CustomerStatus) {
    const res = await setCustomerStatus({ id: customer.id, status });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Marked ${status.toLowerCase()}`);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    try {
      const res = await deleteCustomer(customer.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer deleted");
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
          <Button variant="ghost" size="icon" aria-label="Customer actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/customers/${customer.id}`}>
              <Eye className="h-4 w-4" /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditOpen(true); }}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {customer.status !== "ACTIVE" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void changeStatus("ACTIVE"); }}>
              <UserCheck className="h-4 w-4" /> Mark active
            </DropdownMenuItem>
          )}
          {customer.status !== "INACTIVE" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void changeStatus("INACTIVE"); }}>
              <UserX className="h-4 w-4" /> Mark inactive
            </DropdownMenuItem>
          )}
          {customer.status !== "BLOCKED" && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void changeStatus("BLOCKED"); }}>
              <Ban className="h-4 w-4" /> Block
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerFormDialog customer={customer} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {customer.name || "customer"}?</DialogTitle>
            <DialogDescription>
              This permanently removes the customer and their notes. Past orders are kept but
              unlinked. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
