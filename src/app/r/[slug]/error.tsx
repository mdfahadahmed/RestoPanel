"use client";

import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center bg-ink-950 px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-fog-50">Something went wrong</h1>
        <p className="mt-2 text-fog-400">
          We couldn&apos;t load this page right now. Please try again in a moment.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 transition hover:bg-gold-300"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
