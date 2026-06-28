"use client";

import { useEffect } from "react";

/** Triggers the browser print dialog once the document has rendered. */
export function PrintAuto() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}
