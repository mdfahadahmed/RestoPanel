import { requireTenant } from "@/lib/tenant";
import { getKitchenBoard } from "@/lib/kds/board";
import { KitchenBoard } from "./KitchenBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Kitchen Display" };

export default async function KitchenPage() {
  const { restaurantId } = await requireTenant();
  const board = await getKitchenBoard(restaurantId);
  return <KitchenBoard initial={board} />;
}
