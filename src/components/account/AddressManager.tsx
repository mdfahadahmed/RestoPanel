"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/app/account/actions";
import { addressSchema } from "@/lib/validations/account";

export interface AddressData {
  id: string;
  label: string;
  fullName: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  isDefault: boolean;
}

const EMPTY: Omit<AddressData, "id" | "isDefault"> & { isDefault: boolean } = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
  isDefault: false,
};

export function AddressManager({ initial }: { initial: AddressData[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<AddressData | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setAddresses(initial), [initial]);

  const open = creating || editing !== null;

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAddress(id);
      if (res.ok) {
        toast.success("Address deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onSetDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultAddress(id);
      if (res.ok) {
        toast.success("Default address updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-glow inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
        >
          <Plus className="h-4 w-4" /> Add address
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-ink-900/30 px-6 py-16 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-ink-850 text-fog-400">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">No saved addresses</h3>
          <p className="mt-1 max-w-sm text-sm text-fog-400">
            Add a delivery address to check out faster next time.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="relative rounded-2xl border border-line bg-ink-900/40 p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fog-100">{a.label}</span>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/25 bg-gold-400/10 px-2 py-0.5 text-[11px] font-medium text-gold-300">
                      <Star className="h-3 w-3 fill-current" /> Default
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    aria-label="Edit address"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400 transition hover:bg-ink-800 hover:text-fog-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={pending}
                    aria-label="Delete address"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-0.5 text-sm text-fog-300">
                {a.fullName && <p>{a.fullName}</p>}
                <p>{a.line1}</p>
                {a.line2 && <p>{a.line2}</p>}
                <p className="text-fog-400">
                  {[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}
                </p>
                {a.country && <p className="text-fog-400">{a.country}</p>}
                {a.phone && <p className="text-fog-500">{a.phone}</p>}
              </div>

              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => onSetDefault(a.id)}
                  disabled={pending}
                  className="mt-3 text-xs font-medium text-violet-400 transition hover:text-violet-300 disabled:opacity-50"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <AddressForm
          initial={editing}
          pending={pending}
          onClose={closeForm}
          onSubmit={(values) => {
            startTransition(async () => {
              const res = editing
                ? await updateAddress(editing.id, values)
                : await addAddress(values);
              if (res.ok) {
                toast.success(editing ? "Address updated" : "Address added");
                closeForm();
                router.refresh();
              } else {
                toast.error(res.error);
              }
            });
          }}
        />
      )}
    </div>
  );
}

function AddressForm({
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  initial: AddressData | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const base = initial ?? EMPTY;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const values = {
      label: String(form.get("label") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      country: String(form.get("country") ?? ""),
      notes: String(form.get("notes") ?? ""),
      isDefault: form.get("isDefault") === "on",
    };
    const parsed = addressSchema.safeParse(values);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat)) if (v?.[0]) mapped[k] = v[0];
      setErrors(mapped);
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-ink-900 p-6 shadow-soft sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fog-100">
            {initial ? "Edit address" : "Add address"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field name="label" label="Label" defaultValue={base.label} error={errors.label} required />
            <Field name="fullName" label="Full name" defaultValue={base.fullName ?? ""} error={errors.fullName} />
          </div>
          <Field name="line1" label="Address line 1" defaultValue={base.line1} error={errors.line1} required />
          <Field name="line2" label="Address line 2" defaultValue={base.line2 ?? ""} error={errors.line2} />
          <div className="grid grid-cols-2 gap-3">
            <Field name="city" label="City" defaultValue={base.city} error={errors.city} required />
            <Field name="state" label="State / County" defaultValue={base.state ?? ""} error={errors.state} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="postalCode" label="Postcode" defaultValue={base.postalCode ?? ""} error={errors.postalCode} />
            <Field name="country" label="Country" defaultValue={base.country ?? ""} error={errors.country} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="phone" label="Phone" defaultValue={base.phone ?? ""} error={errors.phone} />
            <Field name="notes" label="Delivery notes" defaultValue={base.notes ?? ""} error={errors.notes} />
          </div>

          <label className="flex items-center gap-2 pt-1 text-sm text-fog-300">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={base.isDefault}
              className="h-4 w-4 rounded border-line bg-ink-800 accent-violet-500"
            />
            Set as default address
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-line bg-ink-800 px-4 py-2.5 text-sm text-fog-300 transition hover:bg-ink-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-glow flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  error,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={`addr-${name}`} className="block text-xs font-medium text-fog-400">
        {label}
      </label>
      <input
        id={`addr-${name}`}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-lg border border-line bg-ink-800/70 px-3 py-2 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
