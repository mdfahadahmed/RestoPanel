import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/account/context";
import { getAccountSettings } from "@/lib/account/service";
import { SettingsForm } from "@/components/account/SettingsForm";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const customer = await requireCustomer();
  const account = await getAccountSettings(customer.accountId);
  if (!account) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">Settings</h1>
        <p className="mt-1 text-sm text-fog-400">
          Manage appearance, language, notifications and security.
        </p>
      </div>

      <SettingsForm
        language={account.language}
        theme={account.theme}
        notifyOrderUpdates={account.notifyOrderUpdates}
        notifyPromotions={account.notifyPromotions}
        notifyRestaurantMsgs={account.notifyRestaurantMsgs}
      />

      <ChangePasswordForm />
    </div>
  );
}
