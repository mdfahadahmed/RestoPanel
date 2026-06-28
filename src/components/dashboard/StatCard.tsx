import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: string;
  className?: string;
}

/** Compact glass metric card used across dashboard overviews. */
export function StatCard({ label, value, icon: Icon, hint, accent = "text-fog-100", className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border border-line bg-ink-900/50 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fog-400">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-fog-500" />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight sm:text-3xl", accent)}>{value}</div>
      {hint && <p className="mt-1 text-xs text-fog-500">{hint}</p>}
    </div>
  );
}
