"use client";

import { Toaster as SonnerToaster } from "sonner";

/** App-wide toast host. Styled to match the dark glass theme. */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-ink-900/95 !border !border-line !text-fog-100 !rounded-xl !backdrop-blur-xl",
          description: "!text-fog-400",
          actionButton: "!bg-white !text-ink-950",
          cancelButton: "!bg-ink-800 !text-fog-300",
          success: "!text-emerald-300",
          error: "!text-rose-300",
        },
      }}
    />
  );
}
