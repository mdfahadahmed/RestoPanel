import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

// The entire admin area is private — keep it out of search indexes. Auth is
// enforced in the (panel) route group's layout, not here, so /admin/login can
// render without a session.
export const metadata: Metadata = {
  title: "RestoPanel Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-fog-100">
      {children}
      <Toaster />
    </div>
  );
}
