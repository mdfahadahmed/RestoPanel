import type { Metadata } from "next";
import { AdminLoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in · RestoPanel",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="bg-mesh grid min-h-screen place-items-center px-4 py-16">
      <AdminLoginForm next={next} />
    </main>
  );
}
