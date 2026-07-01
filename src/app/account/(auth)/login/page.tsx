import { Suspense } from "react";
import { AccountAuthForm } from "@/components/account/AccountAuthForm";

export default function AccountLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="glass h-96 w-full max-w-md animate-pulse rounded-2xl" />
      }
    >
      <AccountAuthForm mode="login" />
    </Suspense>
  );
}
