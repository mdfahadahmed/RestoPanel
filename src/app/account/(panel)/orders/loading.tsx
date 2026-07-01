import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 flex-1 sm:min-w-[220px]" />
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="space-y-2 rounded-2xl border border-line p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
