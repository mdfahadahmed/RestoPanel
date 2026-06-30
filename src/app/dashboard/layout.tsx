import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { PageTransition } from "@/components/dashboard/PageTransition";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter";
import { Toaster } from "@/components/ui/sonner";

// The dashboard is private — keep it out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves the signed-in tenant or redirects to /login.
  const tenant = await requireTenant();

  return (
    <div className="flex min-h-screen bg-ink-950">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-violet-500 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-ink-950/80 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <MobileNav />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold">{tenant.restaurantName}</p>
              <p className="truncate text-xs text-fog-500">
                /{tenant.restaurantSlug} · {tenant.role.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <GlobalSearch />
            <NotificationsCenter />
            <SignOutButton />
          </div>
        </header>
        <main id="dashboard-main" className="flex-1 p-4 sm:p-7">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
