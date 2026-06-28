"use client";

import Link from "next/link";
import { Printer, ChefHat, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Opens a printable document in a new tab; the print view auto-triggers print. */
export function OrderPrintMenu({ id }: { id: string }) {
  const docs = [
    { doc: "kitchen", label: "Kitchen ticket", icon: ChefHat },
    { doc: "receipt", label: "Customer receipt", icon: Receipt },
    { doc: "invoice", label: "Invoice", icon: FileText },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {docs.map(({ doc, label, icon: Icon }) => (
          <DropdownMenuItem key={doc} asChild>
            <Link href={`/print/orders/${id}/${doc}`} target="_blank">
              <Icon className="h-4 w-4" /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
