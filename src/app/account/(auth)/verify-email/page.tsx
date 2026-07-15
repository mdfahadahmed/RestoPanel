import { Suspense } from "react";
import { EmailVerifyClient } from "@/components/account/EmailVerifyClient";
import { verifyEmailToken } from "@/app/account/actions";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={<div className="glass h-56 w-full max-w-md animate-pulse rounded-2xl" />}
    >
      <EmailVerifyClient
        verify={verifyEmailToken}
        homeHref="/account"
        homeLabel="Go to my account"
      />
    </Suspense>
  );
}
