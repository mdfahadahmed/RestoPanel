import { requireCustomer } from "@/lib/account/context";
import { listAddresses } from "@/lib/account/service";
import {
  AddressManager,
  type AddressData,
} from "@/components/account/AddressManager";

export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  const customer = await requireCustomer();
  const rows = await listAddresses(customer.accountId);

  const addresses: AddressData[] = rows.map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    notes: a.notes,
    isDefault: a.isDefault,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
          Saved Addresses
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          Manage your delivery addresses and set a default for faster checkout.
        </p>
      </div>
      <AddressManager initial={addresses} />
    </div>
  );
}
