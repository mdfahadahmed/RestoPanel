import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center">
      <div>
        <p className="text-sm font-medium text-gold-300">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-fog-50">Restaurant not found</h1>
        <p className="mt-2 text-fog-400">This ordering page doesn&apos;t exist or has moved.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 hover:bg-gold-300"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
