export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-800" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-ink-850" />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-ink-900/50">
            <div className="aspect-[4/3] animate-pulse bg-ink-850" />
            <div className="space-y-2 p-3.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-ink-800" />
              <div className="h-3 w-full animate-pulse rounded bg-ink-850" />
              <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-ink-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
