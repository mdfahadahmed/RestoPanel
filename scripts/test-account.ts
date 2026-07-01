/**
 * End-to-end test for the Customer Order Panel (/account).
 *
 * Exercises the REAL account service layer (the same tenant/account-scoped
 * functions the server actions call) against the live database, plus the
 * storefront → account linking and order-status → notification integration.
 * Verifies auth, order history, tracking data, profile/password, address CRUD,
 * favorites, notifications and — critically — that one account can never read
 * another account's data. Cleans up everything it creates.
 *
 * Run: npx tsx scripts/test-account.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  registerAccount,
  authenticateAccount,
  getDashboardData,
  listOrders,
  listOrderedRestaurants,
  getOrderForAccount,
  getActiveOrders,
  updateProfile,
  changePassword,
  updateSettings,
  getAccountSettings,
  bumpTokenVersion,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  listFavorites,
  addFavorite,
  removeFavorite,
  isFavorited,
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../src/lib/account/service";
import {
  notifyAccountOrderStatus,
  notifyAccountOrderPlaced,
} from "../src/lib/account/notify";
import { placeOrderPublic } from "../src/app/r/[slug]/actions";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const q = (over: Partial<Parameters<typeof listOrders>[1]> = {}) => ({
  sort: "date_desc" as const,
  page: 1,
  ...over,
});

async function main() {
  const tag = `__atest_${Date.now()}`;
  const emailA = `${tag}-a@test.dev`;
  const emailB = `${tag}-b@test.dev`;
  const slug1 = `${tag}-r1`;
  const slug2 = `${tag}-r2`;

  // Two restaurants with an orderable product each.
  const r1 = await prisma.restaurant.create({
    data: {
      slug: slug1, name: "Test Bistro", ownerName: "O1",
      taxRate: new Prisma.Decimal(10), deliveryFee: new Prisma.Decimal(4),
      deliveryEnabled: true, pickupEnabled: true, dineInEnabled: true, address: "1 St",
    },
  });
  const r2 = await prisma.restaurant.create({
    data: {
      slug: slug2, name: "Test Diner", ownerName: "O2",
      taxRate: new Prisma.Decimal(0), deliveryFee: new Prisma.Decimal(0),
      pickupEnabled: true,
    },
  });
  const p1 = await prisma.product.create({
    data: { restaurantId: r1.id, name: "Burger", slug: "burger", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(10), discount: new Prisma.Decimal(0) },
  });
  const p2 = await prisma.product.create({
    data: { restaurantId: r2.id, name: "Taco", slug: "taco", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(6), discount: new Prisma.Decimal(0) },
  });

  const created: { accounts: string[] } = { accounts: [] };

  try {
    console.log("\n[1] Registration + guest-order backfill by email");
    // A guest order placed BEFORE registering, using emailA.
    const guestOrder = await placeOrderPublic(slug1, {
      customerName: "Alice", customerPhone: "0700100001", customerEmail: emailA,
      type: "PICKUP", paymentMethod: "CASH",
      items: [{ productId: p1.id, quantity: 2, extras: [] }],
    });
    check("guest order placed", guestOrder.ok, guestOrder);

    const reg = await registerAccount({
      name: "Alice", email: emailA, phone: "0700100001",
      password: "supersecret", confirmPassword: "supersecret",
    });
    check("account A registered", reg.ok, reg);
    if (!reg.ok) throw new Error("account A registration failed");
    const accountA = reg.data!.id;
    created.accounts.push(accountA);

    const dupe = await registerAccount({
      name: "Alice2", email: emailA, password: "supersecret", confirmPassword: "supersecret",
    });
    check("duplicate email rejected", !dupe.ok);

    const dash1 = await getDashboardData(accountA);
    check("guest order backfilled into history (total=1)", dash1.total === 1, dash1);
    check("dashboard active count = 1 (pending)", dash1.active === 1);

    console.log("\n[2] Authentication");
    const good = await authenticateAccount(emailA, "supersecret");
    check("correct password authenticates", good.ok);
    const bad = await authenticateAccount(emailA, "wrong");
    check("wrong password rejected", !bad.ok);
    const noUser = await authenticateAccount("nobody@test.dev", "x");
    check("unknown email rejected", !noUser.ok);

    console.log("\n[3] Multi-restaurant orders + list filters");
    // A signed-in-style order at r2: link by placing then linking via email match.
    await placeOrderPublic(slug2, {
      customerName: "Alice", customerPhone: "0700100002", customerEmail: emailA,
      type: "PICKUP", paymentMethod: "CASH",
      items: [{ productId: p2.id, quantity: 1, extras: [] }],
    });
    // Re-auth links the new guest customer row by email.
    await authenticateAccount(emailA, "supersecret");

    const all = await listOrders(accountA, q());
    check("both restaurants' orders visible (2)", all.total === 2, all.total);
    const rests = await listOrderedRestaurants(accountA);
    check("ordered-restaurants filter list has 2 entries", rests.length === 2);

    const filtered = await listOrders(accountA, q({ restaurantId: r2.id }));
    check("filter by restaurant returns 1", filtered.total === 1 && filtered.orders[0].restaurant.name === "Test Diner");

    const byStatus = await listOrders(accountA, q({ status: "PENDING" }));
    check("filter by status PENDING returns 2", byStatus.total === 2);

    const search = await listOrders(accountA, q({ q: "Taco" }));
    check("search by item name matches r2 order", search.total === 1);

    const sortAsc = await listOrders(accountA, q({ sort: "total_asc" }));
    check("sort total_asc puts Taco (6) first", Number(sortAsc.orders[0].total) === 6, sortAsc.orders.map((o) => Number(o.total)));

    console.log("\n[4] Order detail + tracking scope");
    const firstId = all.orders[0].id;
    const detail = await getOrderForAccount(accountA, firstId);
    check("order detail loads with items + events", !!detail && detail.items.length > 0 && detail.events.length > 0);
    const active = await getActiveOrders(accountA);
    check("active orders returns in-progress (2)", active.length === 2);

    console.log("\n[5] Order-status → account notification (owner integration)");
    // Advance the r1 order and ensure a notification is generated for account A.
    const r1Order = await prisma.order.findFirst({ where: { restaurantId: r1.id }, select: { id: true } });
    await notifyAccountOrderStatus(r1Order!.id, "CONFIRMED");
    const notes1 = await listNotifications(accountA);
    check("status change created a notification", notes1.length >= 1 && notes1[0].type === "ORDER_UPDATE");
    check("unread count reflects new notification", (await unreadNotificationCount(accountA)) >= 1);

    // Respect the preference toggle.
    await updateSettings(accountA, { language: "en", theme: "dark", notifyOrderUpdates: false, notifyPromotions: true, notifyRestaurantMsgs: true });
    const before = (await listNotifications(accountA)).length;
    await notifyAccountOrderStatus(r1Order!.id, "PREPARING");
    const after = (await listNotifications(accountA)).length;
    check("notifications suppressed when order updates disabled", after === before);
    await updateSettings(accountA, { language: "en", theme: "light", notifyOrderUpdates: true, notifyPromotions: true, notifyRestaurantMsgs: true });
    const settings = await getAccountSettings(accountA);
    check("settings persisted (theme=light)", settings?.theme === "light");

    console.log("\n[6] Notifications: read + delete");
    const n = (await listNotifications(accountA))[0];
    await markNotificationRead(accountA, n.id);
    const readOne = await prisma.customerNotification.findUnique({ where: { id: n.id } });
    check("markNotificationRead flips isRead", readOne?.isRead === true);
    await markAllNotificationsRead(accountA);
    check("markAll clears unread", (await unreadNotificationCount(accountA)) === 0);
    await deleteNotification(accountA, n.id);
    check("deleteNotification removes it", (await prisma.customerNotification.findUnique({ where: { id: n.id } })) === null);

    console.log("\n[7] Addresses CRUD + default logic");
    await addAddress(accountA, { label: "Home", line1: "1 Main St", city: "London", isDefault: false } as never);
    let addrs = await listAddresses(accountA);
    check("first address auto-becomes default", addrs.length === 1 && addrs[0].isDefault);
    await addAddress(accountA, { label: "Work", line1: "2 Office Rd", city: "London", isDefault: true } as never);
    addrs = await listAddresses(accountA);
    check("setting new default unsets the old one", addrs.filter((a) => a.isDefault).length === 1 && addrs.find((a) => a.label === "Work")?.isDefault === true);
    const home = addrs.find((a) => a.label === "Home")!;
    await setDefaultAddress(accountA, home.id);
    check("setDefaultAddress switches default", (await prisma.customerAddress.findUnique({ where: { id: home.id } }))?.isDefault === true);
    // Edit while keeping it the default.
    await updateAddress(accountA, home.id, { label: "Home2", line1: "1 Main St", city: "London", isDefault: true } as never);
    check("updateAddress edits label", (await prisma.customerAddress.findUnique({ where: { id: home.id } }))?.label === "Home2");
    // Delete the DEFAULT address — the remaining one should be promoted.
    await deleteAddress(accountA, home.id);
    const afterDel = await listAddresses(accountA);
    check("deleting default removes it + promotes another", afterDel.length === 1 && afterDel[0].isDefault && afterDel[0].label === "Work");

    console.log("\n[8] Favorites");
    await addFavorite(accountA, p1.id);
    await addFavorite(accountA, p1.id); // idempotent
    check("addFavorite is idempotent", (await prisma.customerFavorite.count({ where: { accountId: accountA } })) === 1);
    check("isFavorited true", await isFavorited(accountA, p1.id));
    const favs = await listFavorites(accountA);
    check("listFavorites includes product + restaurant", favs.length === 1 && favs[0].product.restaurant.name === "Test Bistro");
    await removeFavorite(accountA, p1.id);
    check("removeFavorite works", !(await isFavorited(accountA, p1.id)));

    console.log("\n[9] Profile + password");
    const upd = await updateProfile(accountA, { name: "Alice R", email: emailA, phone: "0700100009", avatarUrl: "", avatarKey: "" });
    check("updateProfile succeeds", upd.ok);
    // Second account for email-clash + isolation tests.
    const regB = await registerAccount({ name: "Bob", email: emailB, password: "bobsecret1", confirmPassword: "bobsecret1" });
    check("account B registered", regB.ok);
    if (!regB.ok) throw new Error("account B registration failed");
    const accountB = regB.data!.id;
    created.accounts.push(accountB);
    const clash = await updateProfile(accountA, { name: "Alice", email: emailB, phone: "", avatarUrl: "", avatarKey: "" });
    check("profile email clash rejected", !clash.ok);

    const wrongPw = await changePassword(accountA, { currentPassword: "nope", newPassword: "newsecret1", confirmPassword: "newsecret1" });
    check("changePassword rejects wrong current password", !wrongPw.ok);
    const okPw = await changePassword(accountA, { currentPassword: "supersecret", newPassword: "newsecret1", confirmPassword: "newsecret1" });
    check("changePassword succeeds", okPw.ok);
    if (!okPw.ok) throw new Error("changePassword failed");
    const newTv = okPw.data!.tokenVersion;
    check("changePassword bumps tokenVersion", typeof newTv === "number" && newTv > 0);
    check("new password authenticates", (await authenticateAccount(emailA, "newsecret1")).ok);
    const tv = await bumpTokenVersion(accountA);
    check("bumpTokenVersion increments", tv > newTv);

    console.log("\n[10] Account isolation — the golden rule");
    // Give account B its own order at r2.
    await placeOrderPublic(slug2, { customerName: "Bob", customerPhone: "0700200001", customerEmail: emailB, type: "PICKUP", paymentMethod: "CASH", items: [{ productId: p2.id, quantity: 1, extras: [] }] });
    await authenticateAccount(emailB, "bobsecret1");

    const bDash = await getDashboardData(accountB);
    check("account B sees only its own order (total=1)", bDash.total === 1, bDash.total);
    const crossOrder = await getOrderForAccount(accountB, firstId);
    check("account B CANNOT read account A's order", crossOrder === null);
    const aStillTwo = await getDashboardData(accountA);
    check("account A still sees its 2 orders", aStillTwo.total === 2, aStillTwo.total);

    // Address / favorite isolation.
    await addFavorite(accountB, p2.id);
    check("account B favorites are separate", (await listFavorites(accountB)).length === 1 && (await listFavorites(accountA)).length === 0);
    await addAddress(accountB, { label: "Bob Home", line1: "9 B St", city: "Leeds", isDefault: true } as never);
    check("account B addresses are separate", (await listAddresses(accountB)).length === 1 && (await listAddresses(accountA)).length === 1);
    // B cannot delete A's address.
    const aAddr = (await listAddresses(accountA))[0];
    const stealDelete = await deleteAddress(accountB, aAddr.id);
    check("account B cannot delete account A's address", !stealDelete.ok && (await prisma.customerAddress.findUnique({ where: { id: aAddr.id } })) !== null);
    // B cannot mark A's notification (create one for A first).
    await notifyAccountOrderPlaced(r1Order!.id);
    const aNote = (await listNotifications(accountA))[0];
    await markNotificationRead(accountB, aNote.id);
    check("account B cannot read/modify account A's notification", (await prisma.customerNotification.findUnique({ where: { id: aNote.id } }))?.isRead === false);

    console.log("\n[11] Pagination");
    // Add enough orders to spill onto a second page (perPage = 8).
    for (let i = 0; i < 8; i++) {
      await placeOrderPublic(slug1, { customerName: "Alice", customerPhone: "0700100001", customerEmail: emailA, type: "PICKUP", paymentMethod: "CASH", items: [{ productId: p1.id, quantity: 1, extras: [] }] });
    }
    const page1 = await listOrders(accountA, q());
    check("page 1 caps at perPage (8)", page1.orders.length === 8 && page1.pageCount >= 2, { len: page1.orders.length, pc: page1.pageCount });
    const page2 = await listOrders(accountA, q({ page: 2 }));
    check("page 2 returns the remainder", page2.orders.length === page1.total - 8);
  } finally {
    // Cleanup: accounts (cascades favorites/addresses/notifications), then
    // restaurants (cascades products/orders/customers).
    await prisma.customerAccount.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await prisma.restaurant.deleteMany({ where: { slug: { in: [slug1, slug2] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
