import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { PageTransition } from "@/components/dashboard/PageTransition";
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
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink-950/80 px-5 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{tenant.restaurantName}</p>
              <p className="truncate text-xs text-fog-500">
                /{tenant.restaurantSlug} · {tenant.role.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-line bg-ink-900 px-3 py-1 text-xs text-fog-400 sm:inline">
              ID: {tenant.restaurantId.slice(0, 8)}…
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-5 sm:p-7">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
