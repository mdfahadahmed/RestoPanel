import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/account/context";
import { getAccountSettings } from "@/lib/account/service";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const customer = await requireCustomer();
  const account = await getAccountSettings(customer.accountId);
  if (!account) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">Profile</h1>
        <p className="mt-1 text-sm text-fog-400">
          Update your personal details and account password.
        </p>
      </div>

      <ProfileForm
        name={account.name}
        email={account.email}
        phone={account.phone ?? ""}
        avatarUrl={account.avatarUrl}
        avatarKey={account.avatarKey}
      />

      <ChangePasswordForm />
    </div>
  );
}
