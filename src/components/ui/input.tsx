import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-line bg-ink-800/70 px-3.5 py-2 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fog-300",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
