import Link from "next/link";
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, Music2 } from "lucide-react";

interface StoreFooterProps {
  slug: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  social: { facebook: string | null; instagram: string | null; tiktok: string | null; twitter: string | null };
}

export function StoreFooter({ slug, name, phone, email, address, social }: StoreFooterProps) {
  const base = `/r/${slug}`;
  const socialLinks = [
    { href: social.facebook, icon: Facebook, label: "Facebook" },
    { href: social.instagram, icon: Instagram, label: "Instagram" },
    { href: social.tiktok, icon: Music2, label: "TikTok" },
    { href: social.twitter, icon: Twitter, label: "X" },
  ].filter((s) => s.href);
  return (
    <footer className="mt-16 border-t border-line bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold text-fog-100">{name}</h3>
          <p className="mt-2 max-w-xs text-sm text-fog-500">
            Order online for delivery, takeaway or dine in. Fresh, fast and made to order.
          </p>
          {socialLinks.length > 0 && (
            <div className="mt-4 flex gap-2">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line bg-ink-900 text-fog-300 transition hover:text-fog-50"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fog-200">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-fog-400">
            <li><Link href={`${base}/menu`} className="hover:text-fog-100">Menu</Link></li>
            <li><Link href={`${base}/about`} className="hover:text-fog-100">About</Link></li>
            <li><Link href={`${base}/reservation`} className="hover:text-fog-100">Reservations</Link></li>
            <li><Link href={`${base}/contact`} className="hover:text-fog-100">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fog-200">Get in touch</h4>
          <ul className="mt-3 space-y-2 text-sm text-fog-400">
            {phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-fog-500" /> {phone}</li>}
            {email && <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-fog-500" /> {email}</li>}
            {address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fog-500" /> {address}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-fog-600">
        © {new Date().getFullYear()} {name}. Powered by RestoPanel.
      </div>
    </footer>
  );
}
