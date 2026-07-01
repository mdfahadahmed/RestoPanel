"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { logoutCustomer } from "@/app/account/actions";

export function AccountSignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await logoutCustomer();
      toast.success("Signed out");
      router.replace("/account/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-fog-300 transition hover:bg-ink-800 hover:text-fog-100 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      {!compact && <span>{pending ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
