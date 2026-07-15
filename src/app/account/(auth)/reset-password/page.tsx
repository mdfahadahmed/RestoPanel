import { Suspense } from "react";
import { PasswordResetForm } from "@/components/account/PasswordResetForm";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<div className="glass h-72 w-full max-w-md animate-pulse rounded-2xl" />}
    >
      <PasswordResetForm mode="reset" />
    </Suspense>
  );
}
