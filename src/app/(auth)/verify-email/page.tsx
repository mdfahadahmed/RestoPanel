import { Suspense } from "react";
import { EmailVerifyClient } from "@/components/account/EmailVerifyClient";
import { verifyOwnerEmail } from "./actions";

export default function OwnerVerifyEmailPage() {
  return (
    <Suspense
      fallback={<div className="glass h-56 w-full max-w-md animate-pulse rounded-2xl" />}
    >
      <EmailVerifyClient
        verify={verifyOwnerEmail}
        homeHref="/dashboard"
        homeLabel="Go to dashboard"
      />
    </Suspense>
  );
}
