import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, c) => (
          <div key={c} className="space-y-3 rounded-2xl border border-line p-3">
            <Skeleton className="h-8 w-full rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl opacity-70" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
