# Customer Guide

How diners use a restaurant's RestoPanel site. Every restaurant has its own
branded storefront at `/r/<slug>`, plus a single customer account at `/account`
that works across every RestoPanel restaurant you order from.

## Ordering from a restaurant (`/r/<slug>`)

### Browse
- **Home** — hero, featured dishes, categories, best sellers, reviews, hours, and
  location.
- **Menu** (`/r/<slug>/menu`) — search, filter by category, sort (featured, price,
  name), and price cap. Each card shows price, discount, and Featured/Best-seller
  badges. Prices display in the restaurant's own currency.
- **Product page** (`/r/<slug>/product/<slug>`) — full details, gallery, variants,
  extras, ingredients, calories, prep time, and related items.

### Cart (`/r/<slug>/cart`)
- Add items (with chosen variant/extras); adjust quantity or remove.
- Your cart is saved per restaurant in your browser, so it survives a refresh.
- Subtotal shown; taxes and delivery are calculated at checkout.

### Checkout (`/r/<slug>/checkout`)
1. Choose **Delivery**, **Takeaway (Pickup)**, or **Dine-in** (whichever the
   restaurant offers).
2. Enter your details (delivery address for delivery orders).
3. Apply a **coupon** if you have one.
4. Pick a **payment method** — Cash on delivery/collection, or **Online** (secure
   card payment).
5. Review the price summary (subtotal, discount, tax, delivery) and place the order.
   Cash orders confirm immediately; online orders continue to a secure payment step.

### Track your order
- After ordering you're taken to a live tracking page with a status timeline and
  estimated time.
- Come back any time via **Track order** (`/r/<slug>/track-order`) — enter your
  order number. Statuses: Pending → Confirmed → Preparing → Ready → Out for
  delivery → Delivered (or Cancelled).
- Once delivered, you can leave a **review**.

### Reserve a table (`/r/<slug>/reservation`)
Pick a date, party size, and an available time slot, add any special requests, and
submit. You'll get a confirmation reference.

## Your account (`/account`)

One account for every RestoPanel restaurant. Guest orders placed with your email
are automatically linked when you register or sign in.

### Sign up / in
- **Register** (`/account/register`) or **Sign in** (`/account/login`).
- **Forgot password** (`/account/forgot-password`) — we email a reset link
  (valid 1 hour, single-use).
- **Verify your email** — we send a link on sign-up; a banner reminds you until
  it's confirmed. You can resend it from the account.

### Dashboard (`/account`)
Cards for total, active, completed, and cancelled orders, plus your recent orders.

### My Orders (`/account/orders`)
- Full history across all restaurants, with search, status/restaurant filters,
  sort, and pagination.
- Open any order for full details: items, variants, extras, discount, tax,
  delivery, payment, and its timeline. Each order shows in its restaurant's
  currency.
- **Reorder**, and **cancel** where the restaurant allows it.

### Track (`/account/track`)
Live view of your in-progress orders with progress timelines.

### Favorites (`/account/favorites`)
Dishes you've hearted while browsing — reorder any of them in a tap. Remove ones
you no longer want.

### Saved Addresses (`/account/addresses`)
Add, edit, and delete delivery addresses; set a default (used to prefill checkout).

### Profile (`/account/profile`)
Update your name, phone, email, and avatar photo, and change your password.

### Notifications (`/account/notifications`)
Order updates, promotions, and restaurant announcements. Mark as read or clear.

### Settings (`/account/settings`)
- **Appearance** (dark/light theme) and **language**.
- **Notification preferences** — toggle order updates, promotions, restaurant
  messages.
- **Change password**, view **recent login activity** (device + IP for each
  sign-in), and **sign out of all sessions** everywhere.

## Your privacy & security

- You can only ever see your own data — accounts are strictly isolated.
- Passwords are hashed; reset and verification links are single-use and expire.
- Sign-in attempts are rate-limited, and a reset or "sign out everywhere" signs you
  out of all other devices.
