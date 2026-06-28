import Link from "next/link";

const GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Dashboard", href: "#dashboard" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Testimonials", href: "#testimonials" },
      { label: "Contact", href: "#contact" },
      { label: "Book a demo", href: "#contact" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Create account", href: "/register" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink-950 px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
                R
              </span>
              <span>
                Resto<span className="text-gradient-gold">Panel</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-fog-500">
              The cloud platform that gives every restaurant its own dashboard and
              ordering site. Built for the UK, US & Canada.
            </p>
          </div>

          {GROUPS.map((g) => (
            <div key={g.title}>
              <h4 className="text-sm font-semibold text-fog-200">{g.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-fog-500 transition hover:text-fog-200"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="text-xs text-fog-500">
            © {new Date().getFullYear()} RestoPanel. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-fog-500">
            <Link href="#" className="hover:text-fog-200">Privacy</Link>
            <Link href="#" className="hover:text-fog-200">Terms</Link>
            <Link href="#" className="hover:text-fog-200">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
