"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-rose-500/30 bg-rose-500/10">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-fog-50">Something went wrong</h1>
        <p className="mt-2 text-sm text-fog-400">
          An unexpected error occurred while loading this page. You can try again.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
