import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const NAV = [
  "Overview",
  "Orders",
  "Products",
  "Categories",
  "Customers",
  "Analytics",
  "Reports",
  "Settings",
];

const ORDERS = [
  { id: "#1042", name: "A. Khan", items: 3, total: "£38.50", status: "Preparing", tone: "amber" },
  { id: "#1041", name: "M. Lopez", items: 1, total: "£12.00", status: "Ready", tone: "violet" },
  { id: "#1040", name: "J. Carter", items: 5, total: "£64.20", status: "Delivered", tone: "emerald" },
  { id: "#1039", name: "S. Patel", items: 2, total: "£21.90", status: "Confirmed", tone: "sky" },
];

const toneMap: Record<string, string> = {
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  emerald: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  sky: "bg-sky-400/10 text-sky-300 border-sky-400/20",
};

export function DashboardPreview() {
  return (
    <section id="dashboard" className="relative px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Dashboard"
        title="A control room for your restaurant"
        description="Glassy, fast and focused. Manage today's service and tomorrow's strategy from a single screen."
      />

      <Reveal index={1}>
        <div className="mx-auto mt-14 max-w-6xl overflow-hidden rounded-3xl border border-line bg-ink-900/60 shadow-glow">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
            {/* Sidebar */}
            <aside className="hidden border-r border-line p-4 lg:block">
              <div className="mb-5 flex items-center gap-2 px-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
                  R
                </span>
                <span className="text-sm font-semibold">RestoPanel</span>
              </div>
              <nav className="space-y-1">
                {NAV.map((item, i) => (
                  <div
                    key={item}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      i === 0
                        ? "bg-ink-800 text-fog-100"
                        : "text-fog-400 hover:text-fog-200"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Main */}
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Overview</h3>
                  <p className="text-xs text-fog-500">Today · Bella Tavola</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-line px-3 py-1.5 text-xs text-fog-300">
                    Last 7 days
                  </span>
                  <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-950">
                    Export
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { k: "Revenue", v: "£2,847" },
                  { k: "Orders", v: "126" },
                  { k: "Pending", v: "8" },
                  { k: "Customers", v: "1,204" },
                ].map((c) => (
                  <div key={c.k} className="rounded-xl border border-line bg-ink-850 p-4">
                    <div className="text-xs text-fog-400">{c.k}</div>
                    <div className="mt-1 text-xl font-semibold">{c.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-line bg-ink-850 p-4">
                  <div className="mb-3 text-sm font-medium">Revenue trend</div>
                  <div className="flex h-36 items-end gap-1.5">
                    {[38, 52, 44, 67, 58, 80, 62, 90, 74, 96, 82, 100, 88, 94].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-violet-500/30 to-violet-400"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-ink-850 p-4">
                  <div className="mb-3 text-sm font-medium">Live orders</div>
                  <div className="space-y-2">
                    {ORDERS.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-ink-900 px-3 py-2"
                      >
                        <div className="text-xs">
                          <span className="font-medium text-fog-200">{o.id}</span>
                          <span className="text-fog-500"> · {o.name}</span>
                        </div>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] ${toneMap[o.tone]}`}
                        >
                          {o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
