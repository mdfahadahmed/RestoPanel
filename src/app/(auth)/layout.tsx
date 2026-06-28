import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-ink-950">
            R
          </span>
          <span>
            Resto<span className="text-gradient-gold">Panel</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
