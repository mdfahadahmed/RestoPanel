import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { unreadNotificationCount } from "@/lib/account/service";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { AccountMobileNav } from "@/components/account/AccountMobileNav";
import { AccountSignOutButton } from "@/components/account/AccountSignOutButton";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Account · RestoPanel",
  robots: { index: false, follow: false },
};

export default async function AccountPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves the signed-in customer or redirects to /account/login.
  const customer = await requireCustomer();
  const unread = await unreadNotificationCount(customer.accountId);

  return (
    <div
      className={cn(
        "account-scope flex min-h-screen bg-ink-950 text-fog-100",
        customer.theme === "light" && "account-light"
      )}
      id="account-root"
    >
      <a
        href="#account-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-violet-500 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <AccountSidebar unread={unread} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-ink-950/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <AccountMobileNav unread={unread} />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold">{customer.name}</p>
              <p className="truncate text-xs text-fog-500">{customer.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/account/notifications"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-900 text-fog-300 transition hover:bg-ink-800 hover:text-fog-100"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <AccountSignOutButton />
          </div>
        </header>

        <main id="account-main" className="flex-1 p-4 sm:p-7">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
