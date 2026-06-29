import { requireAdmin } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { GsapReveal } from "@/components/dashboard/GsapReveal";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /admin/login unless a valid, active admin session is present.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-ink-950">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink-950/80 px-5 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <AdminMobileNav />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{admin.name}</p>
              <p className="truncate text-xs text-fog-500">
                {admin.email} · {admin.role.replace("_", " ").toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 sm:inline">
              Platform Admin
            </span>
            <AdminSignOut />
          </div>
        </header>
        <main className="flex-1 p-5 sm:p-7">
          <GsapReveal className="mx-auto max-w-7xl space-y-6">{children}</GsapReveal>
        </main>
      </div>
    </div>
  );
}
