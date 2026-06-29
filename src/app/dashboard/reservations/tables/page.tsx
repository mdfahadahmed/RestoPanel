import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireTenant } from "@/lib/tenant";
import { listTables } from "@/lib/reservations/tables";
import { TablesManager } from "./TablesManager";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurantId } = await requireTenant();
  const tables = await listTables(restaurantId);

  return (
    <>
      <Link href="/dashboard/reservations" className="inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-fog-200">
        <ArrowLeft className="h-4 w-4" /> Back to reservations
      </Link>
      <PageHeader title="Tables" description="Define the tables that bookings are assigned to." />
      <TablesManager
        tables={tables.map((t) => ({
          id: t.id, name: t.name, capacity: t.capacity, location: t.location, isActive: t.isActive, position: t.position,
        }))}
      />
    </>
  );
}
