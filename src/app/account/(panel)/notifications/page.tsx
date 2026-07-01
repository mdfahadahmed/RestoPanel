import { requireCustomer } from "@/lib/account/context";
import { listNotifications } from "@/lib/account/service";
import {
  NotificationsList,
  type NotificationItem,
} from "@/components/account/NotificationsList";

export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const customer = await requireCustomer();
  const rows = await listNotifications(customer.accountId);

  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    restaurantName: n.restaurantName,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          Order updates, promotions and messages from your restaurants.
        </p>
      </div>
      <NotificationsList initial={items} />
    </div>
  );
}
