import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-line bg-ink-800 text-fog-200",
        violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
        emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
        rose: "border-rose-500/25 bg-rose-500/10 text-rose-300",
        gold: "border-gold-400/25 bg-gold-400/10 text-gold-300",
        outline: "border-line text-fog-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
