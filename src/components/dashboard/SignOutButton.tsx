"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-lg border border-line bg-ink-850 px-3 py-1.5 text-xs font-medium text-fog-300 transition hover:border-fog-500 hover:text-fog-100"
    >
      Sign out
    </button>
  );
}
